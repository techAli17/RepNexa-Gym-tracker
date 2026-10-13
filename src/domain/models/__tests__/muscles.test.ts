import { BUILT_IN_EXERCISES } from '../../../data/exercises/builtInExercises';
import { muscleHighlight, regionsForMuscle } from '../muscles';

describe('regionsForMuscle', () => {
  it('maps specific names before generic ones', () => {
    expect(regionsForMuscle('Side delts')).toEqual(['sideDelts']);
    expect(regionsForMuscle('lateral deltoid')).toEqual(['sideDelts']);
    expect(regionsForMuscle('lats')).toEqual(['lats']);
    expect(regionsForMuscle('upper back')).toEqual(['upperBack']);
    expect(regionsForMuscle('lower back')).toEqual(['lowerBack']);
    expect(regionsForMuscle('back')).toEqual(['upperBack', 'lats', 'lowerBack']);
    expect(regionsForMuscle('upper chest')).toEqual(['chest']);
  });

  it('returns nothing for unknown names', () => {
    expect(regionsForMuscle('tongue')).toEqual([]);
  });

  it('recognises every muscle name in the built-in catalog', () => {
    const names = new Set(BUILT_IN_EXERCISES.flatMap(e => [...e.primaryMuscles, ...e.secondaryMuscles]));
    const unknown = [...names].filter(n => regionsForMuscle(n).length === 0);
    expect(unknown).toEqual([]);
  });
});

describe('muscleHighlight', () => {
  it('falls back to the muscle group when no muscles are listed', () => {
    expect(muscleHighlight({ muscleGroup: 'arms', primaryMuscles: [], secondaryMuscles: [] }).primary).toEqual([
      'biceps',
      'triceps',
      'forearms',
    ]);
  });

  it('never repeats a primary region as secondary', () => {
    const h = muscleHighlight({ muscleGroup: 'chest', primaryMuscles: ['chest', 'front delts'], secondaryMuscles: ['shoulders', 'triceps'] });
    expect(h.primary).toEqual(['chest', 'frontDelts']);
    expect(h.secondary).toEqual(['sideDelts', 'rearDelts', 'triceps']);
  });

  it('gives every non-cardio built-in exercise something to highlight', () => {
    const empty = BUILT_IN_EXERCISES.filter(e => e.muscleGroup !== 'cardio' && !muscleHighlight(e).primary.length);
    expect(empty.map(e => e.name)).toEqual([]);
  });
});
