import * as assert from 'assert';

import {initialState, makePlanBetter, AllActions, goalSatisfied} from '../src/app';

describe('planning algorithm', () => {
  it('can find an apple to eat', () => {
    const goal = {
      name: 'Eat',
      goalState: {
        hunger: 100
      }
    }

    const expectedPlan = [
      AllActions[0]
    ]

    const plan = makePlanBetter(
      initialState.agents[0],
      initialState,
      goal
    ) || [];

    assert.deepEqual(plan.map(a => a.name), expectedPlan.map(a => a.name));
  });

  it('can gather a stone', () => {
    const goal = {
      name: 'Own a stone',
      goalState: {
        inventory: {
          stones: 1
        }
      }
    }

    const expectedPlan = [
      AllActions[5]
    ]

    const plan = makePlanBetter(
      initialState.agents[0],
      initialState,
      goal
    ) || [];

    assert.deepEqual(plan.map(a => a.name), expectedPlan.map(a => a.name));
  });

  it('gathers two stones', () => {
    const goal = {
      name: 'Gather a stone',
      goalState: {
        inventory: {
          stones: 2
        }
      }
    }

    const expectedPlan = [
      AllActions[5],
      AllActions[5]
    ]

    const plan = makePlanBetter(
      initialState.agents[0],
      initialState,
      goal
    ) || [];

    assert.deepEqual(plan.map(a => a.name), expectedPlan.map(a => a.name));
  });

  it('can make an axe', () => {
    const goal = {
      name: 'Make an axe',
      goalState: {
        holding: 'axe'
      }
    }

    const expectedPlan = [
      AllActions[6],
      AllActions[5],
      AllActions[4]
    ]

    const plan = makePlanBetter(
      initialState.agents[0],
      initialState,
      goal
    ) || [];

    assert.deepEqual(plan.map(a => a.name), expectedPlan.map(a => a.name));
  });

  it('can make shelter', () => {
    const goal = {
      name: 'Make shelter',
      goalState: {
        hasShelter: true
      }
    }

    const expectedPlan = [
      AllActions[6],
      AllActions[5],
      AllActions[4],
      AllActions[3],
      AllActions[3],
      AllActions[1]
    ]

    const plan = makePlanBetter(
      initialState.agents[0],
      initialState,
      goal
    ) || [];

    assert.deepEqual(plan.map(a => a.name), expectedPlan.map(a => a.name));
  });

  it('can make a shelter in order to sleep', () => {
    const goal = {
      name: 'Sleep',
      goalState: {
        energy: 100
      }
    }

    const expectedPlan = [
      AllActions[6],
      AllActions[5],
      AllActions[4],
      AllActions[3],
      AllActions[3],
      AllActions[1],
      AllActions[8]
    ]

    const plan = makePlanBetter(
      initialState.agents[0],
      initialState,
      goal
    ) || [];

    assert.deepEqual(plan.map(a => a.name), expectedPlan.map(a => a.name));
  });
});
