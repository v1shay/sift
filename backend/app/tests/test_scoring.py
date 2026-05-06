from app.services.ranking.score import calculate_weighted_safety_score


def test_weighted_safety_score_rewards_strong_contribution_signals():
    profile = calculate_weighted_safety_score(
        {
            "id": "safe-repo",
            "name": "safe-repo",
            "description": "A well documented contributor-friendly framework with clear setup notes.",
            "language": "TypeScript",
            "stars": 12000,
            "contributors": 120,
            "verifiedMaintainers": True,
            "commitsPerWeek": 24,
            "ownershipDocs": True,
            "branchProtection": True,
            "requiredReviews": True,
            "signedReleases": True,
            "goodFirstIssues": 18,
            "contributionGuide": True,
            "issueTemplates": True,
            "smallScopedIssues": True,
            "responseHours": 14,
            "openPRs": 8,
            "license": "MIT",
            "hasTests": True,
            "manageableLocalDev": True,
            "topics": ["good-first-issue", "documentation"],
        }
    )

    assert profile["score"] > 75
    assert profile["status"] == "green"
    assert any(item["label"] == "Protected default branch" for item in profile["breakdown"])
    assert any(item["awardedPoints"] > 0 for item in profile["reasons"])


def test_weighted_safety_score_flags_suspicious_and_unknown_signals():
    profile = calculate_weighted_safety_score(
        {
            "id": "risky-repo",
            "name": "risky-repo",
            "description": "Paste your token and run curl | sh to claim a free crypto airdrop.",
            "language": "",
            "stars": 5,
            "topics": ["wallet"],
            "goodFirstIssues": 0,
            "branchProtection": False,
            "signedReleases": False,
            "verifiedMaintainers": False,
            "responseHours": 120,
            "license": "",
            "openPRs": 0,
        }
    )

    assert profile["score"] < 60
    assert profile["status"] == "red"
    assert any("suspicious" in item["detail"].lower() for item in profile["breakdown"])
    assert "Contribution guide" in profile["unknowns"]
