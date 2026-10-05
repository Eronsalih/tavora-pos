export const PLAN_LEVELS = {
  none: 0,
  starter: 1,
  standard: 2,
  pro: 3,
  "platform-owner": 99,
};

export function getPlanLevel(plan) {
  return PLAN_LEVELS[plan] ?? 0;
}

export function hasMinimumPlan(currentPlan, minimumPlan) {
  return (
    getPlanLevel(currentPlan) >=
    getPlanLevel(minimumPlan)
  );
}
