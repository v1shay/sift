from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional

from app.services.ranking.weights import (
    SAFETY_AMBER_THRESHOLD,
    SAFETY_GREEN_THRESHOLD,
    SAFETY_MAX_SCORE,
    SAFETY_WEIGHTS,
)


SUSPICIOUS_TERMS = (
    "paste your token",
    "paste token",
    "disable antivirus",
    "curl | sh",
    "curl -s",
    "private key",
    "seed phrase",
    "wallet",
    "airdrop",
    "free crypto",
    "download binary",
    "run as administrator",
)


def _value(repo: Any, *names: str, default: Any = None) -> Any:
    for name in names:
        if isinstance(repo, Mapping) and name in repo:
            return repo[name]
        if hasattr(repo, name):
            return getattr(repo, name)
    return default


def _bool_value(repo: Any, *names: str) -> Optional[bool]:
    value = _value(repo, *names, default=None)
    return value if isinstance(value, bool) else None


def _int_value(repo: Any, *names: str, default: Optional[int] = None) -> Optional[int]:
    value = _value(repo, *names, default=default)
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _text_value(repo: Any, *names: str) -> str:
    value = _value(repo, *names, default="")
    return str(value or "")


def _topics(repo: Any) -> List[str]:
    raw_topics = _value(repo, "topics", default=[])
    if not raw_topics:
        return []
    result = []
    for topic in raw_topics:
        if isinstance(topic, str):
            result.append(topic)
        elif hasattr(topic, "name"):
            result.append(str(topic.name))
        elif isinstance(topic, Mapping) and "name" in topic:
            result.append(str(topic["name"]))
    return result


def _contributors_count(repo: Any) -> Optional[int]:
    direct = _int_value(repo, "contributors", "contributorsCount", "contributors_count", default=None)
    if direct is not None:
        return direct
    contributors = _value(repo, "contributors", default=None)
    if contributors is None:
        return None
    try:
        return len(contributors)
    except TypeError:
        return None


def _parse_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str):
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _days_since(value: Any) -> Optional[int]:
    parsed = _parse_datetime(value)
    if not parsed:
        return None
    return max(0, (datetime.now(timezone.utc) - parsed).days)


def _has_suspicious_metadata(repo: Any) -> bool:
    text = " ".join(
        [
            _text_value(repo, "name"),
            _text_value(repo, "fullName", "full_name"),
            _text_value(repo, "description"),
            _text_value(repo, "readme"),
            " ".join(_topics(repo)),
        ]
    ).lower()
    return any(term in text for term in SUSPICIOUS_TERMS)


def _status(score: int) -> str:
    if score > SAFETY_GREEN_THRESHOLD:
        return "green"
    if score >= SAFETY_AMBER_THRESHOLD:
        return "amber"
    return "red"


def _color(status: str) -> str:
    return {
        "green": "#34d399",
        "amber": "#fbbf24",
        "red": "#ff6b6b",
    }[status]


def _reason_type(awarded_points: int, weight: int, unknown: bool) -> str:
    if unknown:
        return "unknown"
    return "positive" if awarded_points >= weight * 0.5 else "risk"


class SafetyScoreBuilder:
    def __init__(self) -> None:
        self.breakdown: List[Dict[str, Any]] = []
        self.unknowns: List[str] = []

    def add(
        self,
        category: str,
        key: str,
        label: str,
        detail: str,
        awarded_points: int,
        *,
        unknown: bool = False,
    ) -> None:
        weight = SAFETY_WEIGHTS[category][key]
        points = 0 if unknown else max(0, min(weight, awarded_points))
        reason_type = _reason_type(points, weight, unknown)
        if unknown:
            self.unknowns.append(label)
        self.breakdown.append(
            {
                "category": category,
                "key": key,
                "label": label,
                "detail": detail,
                "weight": weight,
                "awardedPoints": points,
                "type": reason_type,
                "unknown": unknown,
            }
        )

    def build(self) -> Dict[str, Any]:
        score = round(sum(item["awardedPoints"] for item in self.breakdown) / SAFETY_MAX_SCORE * 100)
        status = _status(score)
        reasons = sorted(
            self.breakdown,
            key=lambda item: (
                item["type"] == "unknown",
                item["type"] == "positive",
                -item["weight"],
            ),
        )
        return {
            "score": score,
            "status": status,
            "color": _color(status),
            "breakdown": self.breakdown,
            "reasons": reasons[:8],
            "unknowns": self.unknowns,
            "maxScore": SAFETY_MAX_SCORE,
        }


def calculate_weighted_safety_score(repo: Any) -> Dict[str, Any]:
    builder = SafetyScoreBuilder()

    verified = _bool_value(repo, "verifiedMaintainers", "verified_maintainers", "verified")
    if verified is None:
        owner = _text_value(repo, "owner", "owner_login")
        builder.add(
            "maintainer_trust",
            "verified_maintainers",
            "Verified maintainers",
            "Maintainer verification is not available from the current data.",
            0,
            unknown=not bool(owner),
        )
    else:
        builder.add(
            "maintainer_trust",
            "verified_maintainers",
            "Verified maintainers",
            "Maintainer ownership is clear." if verified else "Maintainer ownership is unclear.",
            12 if verified else 0,
        )

    commits_per_week = _int_value(repo, "commitsPerWeek", "commits_per_week", default=None)
    pushed_at = _value(repo, "pushedAt", "pushed_at", "updatedAt", "updated_at", default=None)
    pushed_days = _days_since(pushed_at)
    recent_activity = (commits_per_week or 0) > 0 or (pushed_days is not None and pushed_days <= 90)
    builder.add(
        "maintainer_trust",
        "recent_maintainer_activity",
        "Recent maintainer activity",
        "Recent commits or pushes indicate active stewardship." if recent_activity else "Recent maintainer activity is stale or unknown.",
        5 if recent_activity else 0,
        unknown=commits_per_week is None and pushed_days is None,
    )

    has_ownership_docs = _bool_value(repo, "ownershipDocs", "codeowners", "governance")
    builder.add(
        "maintainer_trust",
        "clear_ownership_docs",
        "Clear ownership docs",
        "Ownership or governance docs are visible." if has_ownership_docs else "Ownership docs are missing from current data.",
        3 if has_ownership_docs else 0,
        unknown=has_ownership_docs is None,
    )

    branch_protection = _bool_value(repo, "branchProtection", "branch_protection")
    builder.add(
        "review_safeguards",
        "branch_protection",
        "Protected default branch",
        "Default branch changes are gated." if branch_protection else "Default branch protection is missing or unavailable.",
        10 if branch_protection else 0,
        unknown=branch_protection is None,
    )

    required_reviews = _bool_value(repo, "requiredReviews", "requiredStatusChecks", "required_reviews")
    if required_reviews is None and branch_protection is True:
        required_reviews = True
    builder.add(
        "review_safeguards",
        "required_reviews_or_checks",
        "Required reviews or checks",
        "Reviews or status checks reduce unsafe merges." if required_reviews else "Required reviews or checks are missing from current data.",
        6 if required_reviews else 0,
        unknown=required_reviews is None,
    )

    signed_releases = _bool_value(repo, "signedReleases", "signed_releases")
    builder.add(
        "review_safeguards",
        "signed_releases",
        "Signed releases",
        "Release artifacts have provenance signals." if signed_releases else "Release signing is missing or unavailable.",
        4 if signed_releases else 0,
        unknown=signed_releases is None,
    )

    good_first = _int_value(repo, "goodFirstIssues", "good_first_issues", default=None)
    builder.add(
        "contributor_friendliness",
        "good_first_issues",
        "Good-first issues",
        f"{good_first} good-first issues are visible." if good_first is not None else "Good-first issue count is unavailable.",
        8 if good_first and good_first > 0 else 0,
        unknown=good_first is None,
    )

    contribution_guide = _bool_value(repo, "contributionGuide", "contribution_guide", "hasContributing")
    builder.add(
        "contributor_friendliness",
        "contribution_guide",
        "Contribution guide",
        "Contribution instructions are available." if contribution_guide else "Contribution instructions are missing from current data.",
        5 if contribution_guide else 0,
        unknown=contribution_guide is None,
    )

    topics = {topic.lower() for topic in _topics(repo)}
    has_templates = _bool_value(repo, "issueTemplates", "prTemplates", "templatesAndLabels")
    if has_templates is None and topics:
        has_templates = any(topic in topics for topic in {"good-first-issue", "help-wanted", "documentation", "contributing"})
    builder.add(
        "contributor_friendliness",
        "templates_and_labels",
        "Templates and labels",
        "Issue labels or templates guide new contributors." if has_templates else "Contributor labels/templates are not visible.",
        4 if has_templates else 0,
        unknown=has_templates is None,
    )

    small_issues = _bool_value(repo, "smallScopedIssues", "small_scoped_issues")
    if small_issues is None and good_first is not None:
        small_issues = good_first > 0
    builder.add(
        "contributor_friendliness",
        "small_scoped_issues",
        "Small scoped issues",
        "Starter work appears scoped." if small_issues else "Starter work may be hard to scope.",
        3 if small_issues else 0,
        unknown=small_issues is None,
    )

    response_hours = _int_value(repo, "responseHours", "response_hours", default=None)
    if response_hours is None:
        response_points = 0
        response_detail = "Maintainer response time is unavailable."
    elif response_hours <= 24:
        response_points = 8
        response_detail = f"Typical response is around {response_hours} hours."
    elif response_hours <= 72:
        response_points = 5
        response_detail = f"Typical response is around {response_hours} hours."
    else:
        response_points = 1
        response_detail = f"Typical response is around {response_hours} hours, so feedback may be slow."
    builder.add(
        "responsiveness_health",
        "response_time",
        "Maintainer response time",
        response_detail,
        response_points,
        unknown=response_hours is None,
    )

    recent_commits = (commits_per_week or 0) >= 2 or (pushed_days is not None and pushed_days <= 45)
    builder.add(
        "responsiveness_health",
        "recent_commits_or_releases",
        "Recent commits or releases",
        "Recent activity suggests the repo is alive." if recent_commits else "Recent commits/releases are sparse or unknown.",
        4 if recent_commits else 0,
        unknown=commits_per_week is None and pushed_days is None,
    )

    open_prs = _int_value(repo, "openPRs", "open_prs", default=None)
    pr_items: Iterable[Any] = _value(repo, "prs", default=[]) or []
    pr_cadence = (open_prs or 0) > 0 or len(list(pr_items)) > 0
    builder.add(
        "responsiveness_health",
        "pr_cadence",
        "PR review cadence",
        "Open or recent PR activity is visible." if pr_cadence else "PR activity is not visible.",
        3 if pr_cadence else 0,
        unknown=open_prs is None and not pr_cadence,
    )

    suspicious = _has_suspicious_metadata(repo)
    builder.add(
        "repo_hygiene_security",
        "low_visible_risk",
        "Low visible metadata risk",
        "Metadata avoids obvious contribution traps." if not suspicious else "Metadata contains suspicious contribution language.",
        5 if not suspicious else 0,
    )

    license_value = _text_value(repo, "license", "license_spdx")
    builder.add(
        "repo_hygiene_security",
        "license_present",
        "License present",
        "A license is visible." if license_value else "License metadata is missing.",
        3 if license_value else 0,
    )

    description = _text_value(repo, "description")
    builder.add(
        "repo_hygiene_security",
        "readme_or_description_quality",
        "Readable project description",
        "Description gives enough context to judge fit." if len(description) >= 40 else "Description is too thin to judge fit confidently.",
        3 if len(description) >= 40 else 0,
    )

    builder.add(
        "repo_hygiene_security",
        "no_suspicious_metadata",
        "No suspicious links or binaries",
        "No obvious unsafe links, binaries, or secret requests were detected." if not suspicious else "Suspicious links, binaries, or secret requests need review.",
        4 if not suspicious else 0,
    )

    language = _text_value(repo, "language")
    builder.add(
        "complexity_fit",
        "clear_language_and_build",
        "Clear language/build setup",
        f"{language} stack is visible." if language else "Language/build setup is missing.",
        4 if language else 0,
    )

    has_tests = _bool_value(repo, "testInstructions", "hasTests", "tests")
    builder.add(
        "complexity_fit",
        "test_instructions",
        "Test instructions",
        "Test instructions are visible." if has_tests else "Test instructions are missing from current data.",
        3 if has_tests else 0,
        unknown=has_tests is None,
    )

    stars = _int_value(repo, "stars", default=0) or 0
    contributors = _contributors_count(repo)
    manageable = _bool_value(repo, "manageableLocalDev", "manageable_local_dev")
    if manageable is None and contributors is not None:
        manageable = contributors <= 4500 or stars <= 150000
    builder.add(
        "complexity_fit",
        "manageable_local_dev",
        "Manageable local development",
        "Local setup appears manageable." if manageable else "Local development may be heavy for a first contribution.",
        3 if manageable else 0,
        unknown=manageable is None,
    )

    return builder.build()


def score_project_safety(project: Any) -> Dict[str, Any]:
    return calculate_weighted_safety_score(project)
