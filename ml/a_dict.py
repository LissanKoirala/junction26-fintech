"""Feature dictionary shared by the ML-A scripts: key -> (label, unit, scale). scale converts the parquet value
(fractions 0..1) to the display unit (percent 0..100) written into JSON."""

FEATURES = {
    "income_m": ("Monthly income", "€/month", 1),
    "income_salary_m": ("Monthly salary", "€/month", 1),
    "income_other_m": ("Other income", "€/month", 1),
    "housing_level": ("Rent / housing payment", "€/month", 1),
    "housing_share": ("Rent share of income", "%", 100),
    "utilities_m": ("Utilities", "€/month", 1),
    "purchases_m": ("Card purchases", "€/month", 1),
    "n_purchases_m": ("Card purchases", "per month", 1),
    "median_ticket": ("Typical purchase", "€", 1),
    "spend_groceries_m": ("Groceries", "€/month", 1),
    "spend_restaurants_m": ("Eating out", "€/month", 1),
    "spend_transportation_m": ("Transport", "€/month", 1),
    "spend_entertainment_m": ("Entertainment", "€/month", 1),
    "spend_health_m": ("Health", "€/month", 1),
    "spend_home_tech_m": ("Home & tech", "€/month", 1),
    "spend_lifestyle_m": ("Shopping & lifestyle", "€/month", 1),
    "spend_travel_m": ("Travel", "€/month", 1),
    "share_groceries": ("Groceries share of purchases", "%", 100),
    "share_restaurants": ("Eating-out share of purchases", "%", 100),
    "share_transportation": ("Transport share of purchases", "%", 100),
    "share_entertainment": ("Entertainment share of purchases", "%", 100),
    "share_health": ("Health share of purchases", "%", 100),
    "share_home_tech": ("Home & tech share of purchases", "%", 100),
    "share_lifestyle": ("Shopping share of purchases", "%", 100),
    "share_travel": ("Travel share of purchases", "%", 100),
    "basket_must_regular_m": ("Fixed musts", "€/month", 1),
    "basket_must_irregular_m": ("Surprise musts", "€/month", 1),
    "basket_everyday_m": ("Everyday extras", "€/month", 1),
    "share_must_regular": ("Fixed musts share of spending", "%", 100),
    "share_must_irregular": ("Surprise musts share of spending", "%", 100),
    "share_everyday": ("Everyday extras share of spending", "%", 100),
    "everyday_to_income": ("Everyday extras as share of income", "%", 100),
    "small_n_m": ("Small purchases (under 10 €)", "per month", 1),
    "small_total_m": ("Small purchases total", "€/month", 1),
    "small_count_share": ("Small purchases share of all purchases", "%", 100),
    "weekend_share": ("Weekend share of spending", "%", 100),
    "evening_share": ("Evening share of spending (after 18)", "%", 100),
    "payday_burn": ("Extras spent in the 5 days after payday", "%", 100),
    "volatility": ("Month-to-month swing in spending", "%", 100),
    "savings_rate": ("Savings rate", "%", 100),
    "investing_rate": ("Investing rate", "%", 100),
    "invest_m": ("Investing", "€/month", 1),
    "purchases_to_income": ("Card spending as share of income", "%", 100),
    "sweep_share": ("Income moved to another account", "%", 100),
    "min_balance": ("Lowest balance", "€", 1),
    "days_below_zero": ("Days below zero", "days", 1),
    "below_zero_share": ("Share of days below zero", "%", 100),
    "buffer_months": ("Buffer (months of musts)", "months", 1),
    "balance_change": ("Balance change over the year", "€", 1),
    "end_balance": ("Balance now", "€", 1),
}


def label(k):
    return FEATURES[k][0]


def unit(k):
    return FEATURES[k][1]


def disp(k, v):
    """parquet value -> display value"""
    if v is None:
        return None
    return float(v) * FEATURES[k][2]
