"""3-stage decision-council orchestration.

Each council member is a persona (see config.COUNCIL_MEMBERS + prompts.PERSONAS).
Identity is the persona, not the model, so two personas may share a model.
"""

import asyncio
from typing import List, Dict, Any, Tuple
from .openrouter import query_model
from .config import COUNCIL_MEMBERS, CHAIRMAN_MODEL
from .prompts import (
    OUTPUT_RULES,
    PERSONAS,
    STAGE1_PERSONA_PROMPT,
    STAGE2_RANKING_PROMPT,
    STAGE3_COUNCIL_PROMPT,
    TITLE_PROMPT,
)


async def stage1_collect_responses(user_query: str) -> List[Dict[str, Any]]:
    """
    Stage 1: each thinker reacts to the decision in its own persona.

    Args:
        user_query: The decision the user is weighing.

    Returns:
        List of dicts with 'key', 'name', 'model', and 'response' keys.
    """
    async def ask(member: Dict[str, str]):
        prompt = STAGE1_PERSONA_PROMPT.format(
            persona=PERSONAS[member["key"]],
            decision=user_query,
            output_rules=OUTPUT_RULES,
        )
        messages = [{"role": "user", "content": prompt}]
        return member, await query_model(member["model"], messages)

    results = await asyncio.gather(*(ask(m) for m in COUNCIL_MEMBERS))

    stage1_results = []
    for member, response in results:
        if response is not None and response.get("content"):
            stage1_results.append({
                "key": member["key"],
                "name": member["name"],
                "model": member["model"],
                "response": response.get("content", ""),
            })

    return stage1_results


async def stage2_collect_rankings(
    user_query: str,
    stage1_results: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """
    Stage 2: each thinker ranks the anonymized perspectives.

    Returns:
        Tuple of (rankings list, label_to_name mapping). The mapping is keyed
        as "Response A" -> persona name for client-side de-anonymization.
    """
    labels = [chr(65 + i) for i in range(len(stage1_results))]  # A, B, C, ...

    # Anonymous label -> persona display name.
    label_to_name = {
        f"Response {label}": result["name"]
        for label, result in zip(labels, stage1_results)
    }

    responses_text = "\n\n".join([
        f"Response {label}:\n{result['response']}"
        for label, result in zip(labels, stage1_results)
    ])

    ranking_prompt = STAGE2_RANKING_PROMPT.format(
        decision=user_query,
        responses_text=responses_text,
    )
    messages = [{"role": "user", "content": ranking_prompt}]

    # Each council member evaluates, using its own backing model.
    async def rank(member: Dict[str, str]):
        return member, await query_model(member["model"], messages)

    results = await asyncio.gather(*(rank(m) for m in COUNCIL_MEMBERS))

    stage2_results = []
    for member, response in results:
        if response is not None and response.get("content"):
            full_text = response.get("content", "")
            stage2_results.append({
                "key": member["key"],
                "name": member["name"],
                "model": member["model"],
                "ranking": full_text,
                "parsed_ranking": parse_ranking_from_text(full_text),
            })

    return stage2_results, label_to_name


async def stage3_synthesize_final(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    stage2_results: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Stage 3: the Council synthesizes the final balanced verdict.

    Returns:
        Dict with 'name', 'model', and 'response' keys.
    """
    stage1_text = "\n\n".join([
        f"{result['name']}:\n{result['response']}"
        for result in stage1_results
    ])

    stage2_text = "\n\n".join([
        f"{result['name']} ranked them:\n{result['ranking']}"
        for result in stage2_results
    ])

    council_prompt = STAGE3_COUNCIL_PROMPT.format(
        decision=user_query,
        stage1_text=stage1_text,
        stage2_text=stage2_text,
        output_rules=OUTPUT_RULES,
    )
    messages = [{"role": "user", "content": council_prompt}]

    # The verdict is the payoff, so give it more room than the other stages.
    response = await query_model(CHAIRMAN_MODEL, messages, max_tokens=1800)

    if response is None:
        return {
            "name": "The Great Courtroom",
            "model": CHAIRMAN_MODEL,
            "response": "Error: Unable to generate the final verdict.",
        }

    return {
        "name": "The Great Courtroom",
        "model": CHAIRMAN_MODEL,
        "response": response.get("content", ""),
    }


def parse_ranking_from_text(ranking_text: str) -> List[str]:
    """
    Parse the FINAL RANKING section from a thinker's response.

    Returns:
        List of response labels (e.g. "Response A") in ranked order.
    """
    import re

    if "FINAL RANKING:" in ranking_text:
        parts = ranking_text.split("FINAL RANKING:")
        if len(parts) >= 2:
            ranking_section = parts[1]
            numbered_matches = re.findall(r'\d+\.\s*Response [A-Z]', ranking_section)
            if numbered_matches:
                return [re.search(r'Response [A-Z]', m).group() for m in numbered_matches]
            matches = re.findall(r'Response [A-Z]', ranking_section)
            return matches

    matches = re.findall(r'Response [A-Z]', ranking_text)
    return matches


def calculate_aggregate_rankings(
    stage2_results: List[Dict[str, Any]],
    label_to_name: Dict[str, str]
) -> List[Dict[str, Any]]:
    """
    Calculate aggregate rankings (average peer position) per persona.

    Returns:
        List of dicts with persona name and average rank, best to worst.
    """
    from collections import defaultdict

    positions = defaultdict(list)

    for ranking in stage2_results:
        parsed_ranking = parse_ranking_from_text(ranking["ranking"])
        for position, label in enumerate(parsed_ranking, start=1):
            if label in label_to_name:
                positions[label_to_name[label]].append(position)

    aggregate = []
    for name, pos in positions.items():
        if pos:
            aggregate.append({
                "name": name,
                "average_rank": round(sum(pos) / len(pos), 2),
                "rankings_count": len(pos),
            })

    aggregate.sort(key=lambda x: x["average_rank"])
    return aggregate


async def generate_conversation_title(user_query: str) -> str:
    """Generate a short title summarizing the decision (cheap model)."""
    title_prompt = TITLE_PROMPT.format(decision=user_query)
    messages = [{"role": "user", "content": title_prompt}]

    response = await query_model(
        "google/gemini-2.5-flash", messages, timeout=30.0,
        max_tokens=30, reasoning_effort=None,
    )

    if response is None:
        return "New Decision"

    title = response.get("content", "New Decision").strip().strip('"\'')
    if len(title) > 50:
        title = title[:47] + "..."
    return title


async def run_full_council(user_query: str) -> Tuple[List, List, Dict, Dict]:
    """Run the complete 3-stage council process."""
    stage1_results = await stage1_collect_responses(user_query)

    if not stage1_results:
        return [], [], {
            "name": "The Great Courtroom",
            "model": "error",
            "response": "All thinkers failed to respond. Please try again."
        }, {}

    stage2_results, label_to_name = await stage2_collect_rankings(user_query, stage1_results)
    aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_name)
    stage3_result = await stage3_synthesize_final(user_query, stage1_results, stage2_results)

    metadata = {
        "label_to_model": label_to_name,  # key kept for frontend compatibility
        "aggregate_rankings": aggregate_rankings,
    }

    return stage1_results, stage2_results, stage3_result, metadata
