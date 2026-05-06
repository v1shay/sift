SAFETY_WEIGHTS = {
    "maintainer_trust": {
        "verified_maintainers": 12,
        "recent_maintainer_activity": 5,
        "clear_ownership_docs": 3,
    },
    "review_safeguards": {
        "branch_protection": 10,
        "required_reviews_or_checks": 6,
        "signed_releases": 4,
    },
    "contributor_friendliness": {
        "good_first_issues": 8,
        "contribution_guide": 5,
        "templates_and_labels": 4,
        "small_scoped_issues": 3,
    },
    "responsiveness_health": {
        "response_time": 8,
        "recent_commits_or_releases": 4,
        "pr_cadence": 3,
    },
    "repo_hygiene_security": {
        "low_visible_risk": 5,
        "license_present": 3,
        "readme_or_description_quality": 3,
        "no_suspicious_metadata": 4,
    },
    "complexity_fit": {
        "clear_language_and_build": 4,
        "test_instructions": 3,
        "manageable_local_dev": 3,
    },
}

SAFETY_MAX_SCORE = sum(
    weight
    for category in SAFETY_WEIGHTS.values()
    for weight in category.values()
)

SAFETY_GREEN_THRESHOLD = 75
SAFETY_AMBER_THRESHOLD = 60
