import * as assert from 'assert';

// let's model someone hungry who wants to be full
type Agent = {
  hungry: boolean,
  hasFood: boolean
}

type Effect = {
  [propertyToChange: string]: any
}

type PreconditionCheck = (agent: Agent) => boolean;

type Action = {
  name: string;
  canBePerformed: PreconditionCheck;
  effects: Effect
}

type Plan = Action[];

type Goal = {
  [propertyToChange: string]: any
}

function goalSatisfied (agent: Agent, goal: Goal): boolean {
  let equal = true;

  Object.keys(goal).forEach(key => {
    equal = (agent as any)[key] == goal[key];
  });

  return equal;
}

function makePlan (agent: Agent, goal: Goal, actions: Action[], plan: Plan = []): Plan | null {
  if (goalSatisfied(agent, goal)) {
    return plan;
  }

  const possibleActions = actions.filter(action => action.canBePerformed(agent));

  if (possibleActions.length === 0) {
    return null;
  }

  const allPlans = possibleActions.map(action => {
    return makePlan({...agent, ...action.effects}, goal, actions, plan.concat(action))
  })

  return allPlans.find(plan => !!plan) || null;
}

describe('planning algorithm', () => {
  it('takes an agent and a goal and devises a plan', () => {
    const agent = {
      hungry: true,
      hasFood: false
    };

    const goal = {
      hungry: false
    };

    const eat = {
      name: 'Eat',
      canBePerformed: (agent: Agent) => agent.hasFood,
      effects: {
        hungry: false,
        hasFood: false
      }
    };

    const findFood = {
      name: 'Find Food',
      canBePerformed: (agent: Agent) => !agent.hasFood,
      effects: {
        hasFood: true
      }
    }

    const actions = [
      eat,
      findFood
    ];

    const plan = makePlan(agent, goal, actions);

    assert.deepEqual(plan, [
      findFood,
      eat
    ]);
  });
});
