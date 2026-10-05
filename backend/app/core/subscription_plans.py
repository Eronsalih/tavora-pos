import os


def _price(env_name: str, default: int) -> int:
    return int(os.getenv(env_name, str(default)))


SUBSCRIPTION_PLANS = {
    "starter": {
        "id": "starter",
        "name": "Starter",
        "price_minor": _price("TAVORA_STARTER_PRICE_MINOR", 999),
        "yearly_price_minor": _price(
            "TAVORA_STARTER_YEARLY_PRICE_MINOR",
            9990,
        ),
        "currency": "EUR",
        "duration_days": 30,
        "yearly_duration_days": 365,
        "features": [
            "tablesOrders",
            "cashCard",
            "productsStock",
            "xReport",
            "zReport",
        ],
    },
    "standard": {
        "id": "standard",
        "name": "Standard",
        "price_minor": _price("TAVORA_STANDARD_PRICE_MINOR", 2999),
        "yearly_price_minor": _price(
            "TAVORA_STANDARD_YEARLY_PRICE_MINOR",
            29990,
        ),
        "currency": "EUR",
        "duration_days": 30,
        "yearly_duration_days": 365,
        "features": [
            "everythingStarter",
            "kitchenBar",
            "reports",
            "xReport",
            "zReport",
        ],
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price_minor": _price("TAVORA_PRO_PRICE_MINOR", 4999),
        "yearly_price_minor": _price(
            "TAVORA_PRO_YEARLY_PRICE_MINOR",
            49990,
        ),
        "currency": "EUR",
        "duration_days": 30,
        "yearly_duration_days": 365,
        "features": [
            "everythingStandard",
            "xReport",
            "zReport",
            "complimentaryRelease",
            "adminPinApproval",
            "complimentaryAudit",
            "prioritySupport",
        ],
    },
}


def public_subscription_plans() -> list[dict]:
    return [
        {
            **plan,
            "price": round(plan["price_minor"] / 100, 2),
            "yearly_price": round(
                plan["yearly_price_minor"] / 100,
                2,
            ),
        }
        for plan in SUBSCRIPTION_PLANS.values()
    ]
