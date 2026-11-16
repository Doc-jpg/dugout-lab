import type { DiagramActor, DrillDiagram, Pt, Where } from '../engine/diagram';

/**
 * Pictures for library drills, keyed by drill id.
 *
 * Rules for writing one (tests/diagrams.test.ts enforces most of them):
 * - Draw only what the drill's own setup and steps say. Every distance written on a picture comes from the drill's words.
 * - Field pictures are seen from behind home plate: first base on the RIGHT, third on the left.
 * - A player facing the coach has his right hand on the viewer's LEFT. Check every "glove side" and "right shoulder".
 * - Every ball starts in somebody's hands and ends in somebody's hands (or a net). A coach beside the plate may hit from the plate.
 * - A line never runs through a person it has nothing to do with. If a throw is meant to go through a cutoff man, say so with `past`.
 * - One step, one or two sentences a helper coach can read out loud.
 * - Where an assignment varies from program to program, say so in the note.
 */

const f = (id: string, at: Where, label = id): DiagramActor => ({ id, kind: 'fielder', label, at });
const run = (id: string, at: Where, label = 'R'): DiagramActor => ({ id, kind: 'runner', label, at });
const coach = (at: Where, id = 'Co', label = 'Coach'): DiagramActor => ({ id, kind: 'coach', label, at });
const cone = (id: string, at: Pt): DiagramActor => ({ id, kind: 'cone', at });
const gear = (id: string, at: Where, label: string): DiagramActor => ({ id, kind: 'gear', label, at });
const line = (at: Pt, label = 'next'): DiagramActor => ({ id: 'line', kind: 'waiting', label, at });
const base = (id: string, at: Pt): DiagramActor => ({ id, kind: 'base', at });

/** A coach beside the plate, third base side. HIT_R is the first base side; HIT_FAR stands farther off in the small-scale pictures. */
const HIT = 'coachHome';
const HIT_R = 'coachHomeR';
const HIT_FAR = 'coachHomeFar';
/** The whole field, a little closer than the default. */
const WIDE: DrillDiagram['view'] = [-128, 128, -24, 214];
/** The left half and the right half of the field, closer still. */
const LEFT: DrillDiagram['view'] = [-112, 68, -24, 166];
const RIGHT: DrillDiagram['view'] = [-68, 112, -24, 166];
/** The first base side of the infield, for leads and steals. */
const FIRST_SIDE: DrillDiagram['view'] = [-30, 66, -16, 96];
const INFIELD = [f('P', 'P'), f('C', 'C'), f('1B', '1B'), f('2B', '2B'), f('SS', 'SS'), f('3B', '3B')];
const OUTFIELD = [f('LF', 'LF'), f('CF', 'CF'), f('RF', 'RF')];
const VARIES = 'Standard assignments. If your program teaches them differently, coach it your way.';

/** Covering a base a runner is coming to: on the bag's edge, out of the runner's path, so the two markers do not hide each other. */
const COVER_2B_SS: Pt = [-6, 91.5]; // shortstop at second, outfield side
/** A runner who is about to be forced or thrown out stops a few steps short, so the fielder on the bag can be seen. */
const SHORT_OF_2B: Pt = [8.5, 76.4];
const SHORT_OF_3B: Pt = [-32.5, 52.3];
/** A first baseman holding a runner on. Drawn a little down the line so the two markers do not hide each other. */
const HOLDING: Pt = [34, 35];
/** A single pulled toward the right field line, the kind a runner goes first to third on. */
const HIT_RIGHT_LINE: Pt = [88, 130];
const COVER_3B: Pt = [-33.4, 42.4]; // third baseman at third, infield side
/** Where a single to left, to right and up the middle is fielded. Chosen so the ball's path misses the infielders, as a real single does. */
const HIT_LEFT: Pt = [-66, 146];
const HIT_RIGHT: Pt = [66, 146];
const HIT_CENTER: Pt = [32, 182];

export const DIAGRAMS: Record<string, DrillDiagram> = {
  // ---------------------------------------------------------------- INFIELD
  'lib-inf-003': {
    field: 'open',
    actors: [coach([50, 7]), f('F', [50, 45], '1'), cone('c1', [38, 45]), cone('c2', [62, 45]), f('T', [88, 30], '2'), line([14, 52])],
    marks: [{ at: [76, 8], text: 'coach 40 ft away' }, { at: [50, 54], text: 'cones 10 ft each side' }],
    plays: [
      { name: 'Forehand (glove side)', ball: '@Co', steps: [
        { say: 'Coach rolls it to the glove side. Fielder shuffles, plants the back foot, and fields with the glove open to the ball.', moves: [{ kind: 'ground', to: [60, 44] }, { kind: 'run', who: 'F', to: [60, 44] }] },
        { say: 'Finish the rep with a throw to a partner.', moves: [{ kind: 'throw', to: '@T' }] }
      ] },
      { name: 'Backhand (throwing side)', ball: '@Co', steps: [
        { say: 'Coach rolls it to the throwing side. Fielder crosses over, plants on the throwing-side foot, glove turned over, elbow up.', moves: [{ kind: 'ground', to: [40, 44] }, { kind: 'run', who: 'F', to: [40, 44] }] },
        { say: 'Finish the rep with a throw to a partner.', moves: [{ kind: 'throw', to: '@T' }] }
      ] }
    ],
    note: 'Drawn for a right-handed thrower facing the coach. For a lefty the two sides swap.'
  },
  'lib-inf-004': {
    field: 'infield',
    actors: [coach([-11, 41]), f('SS', 'SS'), f('1B', 'first'), line([-52, 96])],
    marks: [{ at: [-38, 56], text: '40 ft' }],
    plays: [
      { name: 'One rep', ball: '@Co', steps: [
        { say: 'Coach rolls a ground ball. Field it out front with two hands.', moves: [{ kind: 'ground', to: '@SS' }] },
        { say: 'Ball to the belly button as the feet start moving at the target. Throw while the body is already going that way.', moves: [{ kind: 'throw', to: '@1B' }] }
      ] }
    ],
    note: 'The target is a partner, or a cone with a glove on it, at the base distance for the age.'
  },
  'lib-inf-005': {
    field: 'infield',
    actors: [coach([0, 37]), f('SS', 'SS'), f('2B', '2B'), f('1B', 'first')],
    plays: [
      { name: 'Ball to short', ball: '@Co', steps: [
        { say: 'Coach hits to the shortstop. The second baseman breaks to the bag.', moves: [{ kind: 'ground', to: '@SS' }, { kind: 'run', who: '2B', to: 'second' }] },
        { say: 'Shortstop feeds him: a firm throw to the chest, no fake.', moves: [{ kind: 'throw', to: '@2B' }] },
        { say: 'Later rounds: the receiver finishes the turn with a throw to first (a first baseman or a net).', moves: [{ kind: 'throw', to: '@1B' }] }
      ] },
      { name: 'Ball to second', ball: '@Co', steps: [
        { say: 'Coach hits to the second baseman. The shortstop breaks to the bag.', moves: [{ kind: 'ground', to: '@2B' }, { kind: 'run', who: 'SS', to: 'second' }] },
        { say: 'Close to the bag he flips underhand, showing the ball. Farther away he turns and throws.', moves: [{ kind: 'toss', to: '@SS' }] },
        { say: 'Later rounds: the receiver finishes the turn with a throw to first (a first baseman or a net).', moves: [{ kind: 'throw', to: '@1B' }] }
      ] }
    ]
  },
  'lib-inf-006': {
    field: 'infield',
    actors: [f('SS', [-29, 78]), f('2B', [29, 78]), f('1B', 'first')],
    marks: [{ at: [0, 108], text: 'feeder 30 ft from the bag' }],
    plays: [
      { name: 'Shortstop turn', ball: '@2B', steps: [
        { say: 'Shortstop sets up behind the bag, hands up, ready to come to the ball. The second baseman is the feeder.', moves: [{ kind: 'run', who: 'SS', to: [-4, 91] }] },
        { say: 'Feeder tosses chest high. Shortstop comes to the ball and touches the bag with his left foot.', moves: [{ kind: 'toss', to: 'second' }, { kind: 'run', who: 'SS', to: 'second' }] },
        { say: 'Step and throw across to first (a first baseman or a net).', moves: [{ kind: 'throw', to: '@1B' }] }
      ] },
      { name: 'Second baseman turn', ball: '@SS', steps: [
        { say: 'Second baseman sets up behind the bag, hands up, ready to come to the ball. The shortstop is the feeder.', moves: [{ kind: 'run', who: '2B', to: [4, 91] }] },
        { say: 'Feeder tosses chest high. Second baseman comes to the ball and touches the bag with his right foot.', moves: [{ kind: 'toss', to: 'second' }, { kind: 'run', who: '2B', to: 'second' }] },
        { say: 'Hop back off the bag and throw to first (a first baseman or a net).', moves: [{ kind: 'throw', to: '@1B' }] }
      ] }
    ],
    note: 'The feeder can be a coach standing in the same spot.'
  },
  'lib-inf-007': {
    field: 'infield',
    actors: [coach(HIT), f('3B', '3B'), f('SS', 'SS'), f('1B', 'first')],
    marks: [{ at: [44, 6], text: 'ball stops 20 to 40 ft out' }],
    plays: [
      { name: 'From third', ball: 'home', steps: [
        { say: 'Coach rolls a slow one. Third baseman charges hard from the first step and fields it out in front of the glove-side foot.', moves: [{ kind: 'ground', to: [-17, 26] }, { kind: 'run', who: '3B', to: [-17, 26] }] },
        { say: 'Throw across the body on the run. No stopping.', moves: [{ kind: 'throw', to: '@1B' }] }
      ] },
      { name: 'From shortstop', ball: 'home', steps: [
        { say: 'Coach rolls a slow one. Shortstop charges hard from the first step and fields it out in front of the glove-side foot.', moves: [{ kind: 'ground', to: [-9, 36] }, { kind: 'run', who: 'SS', to: [-9, 36] }] },
        { say: 'Throw across the body on the run. No stopping.', moves: [{ kind: 'throw', to: '@1B' }] }
      ] }
    ],
    note: 'First base is a first baseman or a net. One ball live at a time.'
  },
  'lib-inf-009': {
    field: 'infield',
    actors: [coach(HIT), f('1B', '1B'), f('2B', '2B'), f('SS', 'SS'), f('3B', '3B'), run('R', 'first')],
    plays: [
      { name: 'Runner on first', ball: 'home', steps: [
        { say: 'Coach calls it before the hit: runner on first, one out. Ground ball. The fielder says the base out loud before he fields it.', moves: [{ kind: 'ground', to: '@SS' }, { kind: 'run', who: 'R', to: SHORT_OF_2B }, { kind: 'run', who: '2B', to: 'second' }] },
        { say: 'He said two. Throw to second for the force, ahead of the runner.', moves: [{ kind: 'throw', to: '@2B' }] }
      ] },
      { name: 'Nobody on', ball: 'home', hide: ['R'], steps: [
        { say: 'Coach calls it before the hit: nobody on. Ground ball. The fielder says the base out loud before he fields it.', moves: [{ kind: 'ground', to: '@3B' }, { kind: 'run', who: '1B', to: 'first' }] },
        { say: 'He said one. Throw to first.', moves: [{ kind: 'throw', to: '@1B' }] }
      ] }
    ],
    note: 'Two examples. Change the situation every two or three hits; the call matters more than the throw.'
  },

  // ---------------------------------------------------------------- OUTFIELD
  'lib-of-001': {
    field: 'open',
    actors: [coach([50, 8]), f('p1', [36, 30], '1'), f('p2', [50, 30], '2'), f('p3', [64, 30], '3')],
    marks: [{ at: [64, 17], text: '20 ft' }, { at: [18, 38], text: 'players 6 ft apart' }],
    plays: [
      { name: 'Over the right shoulder', ball: '@Co', steps: [
        { say: 'First with no ball: coach points, everyone drops that foot back and turns the hips.', moves: [] },
        { say: 'Then one at a time: coach tosses over the right shoulder. Drop step and run to catch it.', moves: [{ kind: 'fly', to: [35, 52], curve: -0.1 }, { kind: 'run', who: 'p2', to: [35, 52], curve: 0.16 }] }
      ] },
      { name: 'Over the left shoulder', ball: '@Co', steps: [
        { say: 'First with no ball: coach points, everyone drops that foot back and turns the hips.', moves: [] },
        { say: 'Then one at a time: coach tosses over the left shoulder. Drop step and run to catch it.', moves: [{ kind: 'fly', to: [65, 52], curve: 0.1 }, { kind: 'run', who: 'p2', to: [65, 52], curve: -0.16 }] }
      ] }
    ],
    note: 'Players face the coach, so a player\'s right shoulder is on your left as you look at the picture.'
  },
  'lib-of-003': {
    field: 'full',
    view: RIGHT,
    actors: [coach(HIT), f('RF', 'RF'), f('Cut', [23, 37]), f('C', 'C')],
    marks: [{ at: [70, 22], text: 'cutoff 40 to 50 ft from home' }],
    plays: [
      { name: 'Do or die', ball: '@Co', steps: [
        { say: 'Coach sets it up: runner on second, two outs, tying run. Ground ball. Outfielder charges hard and fields it outside the glove-side foot, on the run.', moves: [{ kind: 'ground', to: [64, 113] }, { kind: 'run', who: 'RF', to: [64, 113] }] },
        { say: 'Crow hop and throw through the cutoff to home.', moves: [{ kind: 'throw', to: '@C', past: ['Cut'] }] }
      ] }
    ],
    note: 'Shown from right field. Run it from any outfield spot; the cutoff stays in line between the ball and home.'
  },
  'lib-of-006': {
    field: 'full',
    view: LEFT,
    actors: [coach(HIT_R), f('LF', 'LF'), f('Cut', [-36, 112]), f('2B', 'second')],
    marks: [{ at: [14, 124], text: 'cutoff 40 to 50 ft from the base' }],
    plays: [
      { name: 'Through the cutoff', ball: '@Co', steps: [
        { say: 'Coach hits a fly or a ground ball to the outfielder.', moves: [{ kind: 'fly', to: '@LF', curve: -0.07 }] },
        { say: 'Cutoff man is in line with both hands up, yelling the base. Outfielder throws low and hard at his head.', moves: [{ kind: 'throw', to: '@Cut' }] },
        { say: 'He relays it to the base. If he lets it go instead, it should get there on one hop.', moves: [{ kind: 'throw', to: '@2B' }] }
      ] }
    ],
    note: 'Shown from left field to second base. The same line works for any outfielder and any base.'
  },
  'lib-of-008': {
    field: 'infield',
    view: [-80, 80, -22, 152],
    actors: [coach(HIT), f('SS', 'SS'), f('LF', [-52, 134]), f('2B', '2B'), f('RF', [52, 134])],
    marks: [{ at: [-63, 104], text: '60 ft behind' }],
    plays: [
      { name: 'Left side', ball: 'home', steps: [
        { say: 'Coach hits a short fly into the gap between them. Both go hard.', moves: [{ kind: 'fly', to: [-40, 108], curve: 0.06 }, { kind: 'run', who: 'LF', to: [-40, 108] }, { kind: 'run', who: 'SS', to: [-26, 94] }] },
        { say: 'The outfielder coming in decides early and calls it loud. The infielder stops, peels off, turns, and sets up as the relay.', moves: [{ kind: 'run', who: 'SS', to: [-12, 102] }] },
        { say: 'With a runner tagging up, the catch is followed by a throw to the relay.', moves: [{ kind: 'throw', to: '@SS' }] }
      ] },
      { name: 'Right side', ball: 'home', steps: [
        { say: 'Coach hits a short fly into the gap between them. Both go hard.', moves: [{ kind: 'fly', to: [40, 108], curve: -0.06 }, { kind: 'run', who: 'RF', to: [40, 108] }, { kind: 'run', who: '2B', to: [26, 94] }] },
        { say: 'The outfielder coming in decides early and calls it loud. The infielder stops, peels off, turns, and sets up as the relay.', moves: [{ kind: 'run', who: '2B', to: [12, 102] }] },
        { say: 'With a runner tagging up, the catch is followed by a throw to the relay.', moves: [{ kind: 'throw', to: '@2B' }] }
      ] }
    ],
    note: 'Outfielder has the right of way unless he says take it. No diving in the gap.'
  },

  // ---------------------------------------------------------------- BASERUNNING
  'lib-br-001': {
    field: 'infield',
    view: FIRST_SIDE,
    actors: [coach('mound'), f('1B', [37.5, 40.5]), run('R', 'first'), cone('lead', [40.2, 53]), gear('Net', [0, -6], 'Net'), line([55, 24])],
    marks: [{ at: [51, 64], text: 'lead 8 to 10 ft' }],
    plays: [
      { name: 'Pitch: go', ball: '@Co', steps: [
        { say: 'Runner takes a lead he can dive back from. For most kids that is two and a half steps.', moves: [{ kind: 'run', who: 'R', to: [36, 48.8] }] },
        { say: 'As the coach lifts to pitch, the runner shuffles two more steps (the secondary) and lands ready. Feet never cross.', moves: [{ kind: 'run', who: 'R', to: [31.4, 53.4] }, { kind: 'throw', to: '@Net' }] },
        { say: 'It was a pitch, so he goes.', moves: [{ kind: 'run', who: 'R', to: 'second' }] }
      ] },
      { name: 'Throw to first: back', ball: '@Co', steps: [
        { say: 'Runner takes a lead he can dive back from. For most kids that is two and a half steps.', moves: [{ kind: 'run', who: 'R', to: [36, 48.8] }] },
        { say: 'Coach turns and throws to first. Runner reads it and gets back.', moves: [{ kind: 'throw', to: '@1B' }, { kind: 'run', who: 'R', to: 'first', back: true, curve: 0.3 }] }
      ] }
    ],
    note: 'The cone marks the lead. Helmets on.'
  },
  'lib-br-003': {
    field: 'full',
    view: [-82, 98, -24, 160],
    actors: [coach(HIT), run('R', 'first'), f('RF', [78, 128]), coach('box3', 'Co3', '3B coach'), f('3B', COVER_3B)],
    plays: [
      { name: 'First to third', ball: '@Co', steps: [
        { say: 'Coach hits or throws a single to the outfield. Runner goes.', moves: [{ kind: 'ground', to: '@RF' }, { kind: 'run', who: 'R', to: 'second', curve: -0.1 }] },
        { say: 'Tight turn at second, touching the inside corner. Halfway to third he looks at the third base coach: go or stop.', moves: [{ kind: 'run', who: 'R', to: [-21, 63.6] }] },
        { say: 'On go he takes third. On half the reps the outfielder makes a real throw to the base.', moves: [{ kind: 'run', who: 'R', to: 'third' }, { kind: 'throw', to: '@3B' }] }
      ] }
    ],
    note: 'The ball can go to right or center. The third base coach mixes his signals. Throw to the base, never at the runner.'
  },
  'lib-br-004': {
    field: 'full',
    view: LEFT,
    actors: [coach(HIT_R), run('R', 'third'), f('LF', [-70, 150]), f('C', 'C')],
    plays: [
      { name: 'Deep fly: go', ball: '@Co', steps: [
        { say: 'Foot on the base. Runner watches the outfielder, not the ball, and says go or stay.', moves: [{ kind: 'fly', to: '@LF', curve: -0.08 }] },
        { say: 'The instant the ball hits the glove, he goes. Coach calls safe or out from the throw.', moves: [{ kind: 'run', who: 'R', to: 'home' }, { kind: 'throw', to: '@C' }] }
      ] },
      { name: 'Shallow fly: stay', ball: '@Co', steps: [
        { say: 'Foot on the base. Runner watches the outfielder, not the ball, and says go or stay.', moves: [{ kind: 'fly', to: [-48, 104], curve: -0.08 }, { kind: 'run', who: 'LF', to: [-48, 104] }] },
        { say: 'Too shallow. He says stay and holds the base while the ball comes back in.', moves: [{ kind: 'throw', to: '@C' }] }
      ] }
    ],
    note: 'Shown with the runner at third. The same read works from second.'
  },
  'lib-br-005': {
    field: 'infield',
    view: FIRST_SIDE,
    actors: [f('P', 'P'), f('C', 'C'), f('SS', 'SS'), run('R', 'first'), cone('lead', [40.2, 53])],
    marks: [{ at: [51, 64], text: 'lead 2 to 3 steps' }],
    plays: [
      { name: 'Heel lifts: go', ball: '@P', steps: [
        { say: 'Runner takes his lead and watches the pitcher\'s front foot.', moves: [{ kind: 'run', who: 'R', to: [36, 48.8] }] },
        { say: 'Front heel lifts to pitch: go. The first step is a crossover, not a false step.', moves: [{ kind: 'throw', to: '@C' }, { kind: 'run', who: 'R', to: 'second' }] },
        { say: 'Last three reps only: the catcher throws to second.', moves: [{ kind: 'run', who: 'SS', to: COVER_2B_SS }, { kind: 'throw', to: '@SS', curve: 0.12 }] }
      ] },
      { name: 'Foot steps to first: back', ball: '@P', steps: [
        { say: 'Runner takes his lead and watches the pitcher\'s front foot.', moves: [{ kind: 'run', who: 'R', to: [36, 48.8] }] },
        { say: 'Front foot steps toward first: get back, standing up.', moves: [{ kind: 'run', who: 'R', to: 'first', back: true, curve: 0.3 }] }
      ] }
    ],
    note: 'The pitcher can be a coach. No throw to first early on; he only shows the move. The cone marks the lead.'
  },
  'lib-br-006': {
    field: 'infield',
    actors: [run('R', 'home'), line([-22, -12], 'line'), coach('box1'), cone('c0', [49.5, 49.5]), cone('c1', [33.9, 29.7]), cone('c2', [12.7, 76.4]), cone('c3', [-33.9, 55.1]), cone('c4', [-12.7, 8.5])],
    marks: [{ at: [60, 62], text: '10 ft past first' }, { at: [0, 112], text: 'curve cones: 15 ft before each base, 3 ft outside the line' }],
    plays: [
      { name: 'Run through first', steps: [
        { say: 'Sprint through first base to the cone, break down, and look right for an overthrow.', moves: [{ kind: 'run', who: 'R', to: [49.5, 49.5] }] }
      ] },
      { name: 'Round first', steps: [
        { say: 'Swing out a few steps before first, by the cone, and touch the inside corner of the base.', moves: [{ kind: 'run', who: 'R', to: 'first', curve: -0.18 }] },
        { say: 'Head toward second.', moves: [{ kind: 'run', who: 'R', to: [28, 57] }] }
      ] },
      { name: 'Home to home', steps: [
        { say: 'Round first: swing out by the cone, touch the inside corner.', moves: [{ kind: 'run', who: 'R', to: 'first', curve: -0.18 }] },
        { say: 'Round second the same way.', moves: [{ kind: 'run', who: 'R', to: 'second', curve: -0.18 }] },
        { say: 'Round third the same way.', moves: [{ kind: 'run', who: 'R', to: 'third', curve: -0.18 }] },
        { say: 'Home. Coach checks the touch on every base.', moves: [{ kind: 'run', who: 'R', to: 'home', curve: -0.18 }] }
      ] }
    ],
    note: 'One runner on the bases at a time. Helmets on.'
  },
  'lib-br-008': {
    field: 'full',
    view: LEFT,
    actors: [coach(HIT_R), run('R', 'second'), f('LF', [-80, 142]), f('Cut', [-23, 37]), f('C', 'C'), coach('box3', 'Co3', '3B coach')],
    plays: [
      { name: 'Single to left', ball: '@Co', steps: [
        { say: 'Coach calls the outs, then hits a single. With two outs the runner already has a big secondary; with one out, a normal one.', moves: [{ kind: 'ground', to: [-72, 128] }, { kind: 'run', who: 'LF', to: [-72, 128] }, { kind: 'run', who: 'R', to: 'third', curve: -0.1 }] },
        { say: 'He rounds third hard and reads the coach. The outfield plays it live and tries to throw him out.', moves: [{ kind: 'run', who: 'R', to: 'home', curve: -0.1 }, { kind: 'throw', to: '@C', past: ['Cut'] }] }
      ] }
    ],
    note: 'Shown with a single to left; hit it to all three fields. A run scored is a point, and so is a correct stop.'
  },

  // ---------------------------------------------------------------- TEAM DEFENSE
  'lib-td-001': {
    field: 'full',
    view: WIDE,
    actors: [coach(HIT_FAR), ...INFIELD, ...OUTFIELD, run('R', 'first')],
    plays: [
      { name: 'Single to left', ball: 'home', hide: ['R'], steps: [
        { say: 'Coach says single to left, nobody on, and everyone walks to his spot: shortstop is the cutoff, second baseman covers second, center backs up left, right backs up the throw, corners cover their bases.', moves: [
          { kind: 'ground', to: HIT_LEFT }, { kind: 'run', who: 'LF', to: HIT_LEFT }, { kind: 'run', who: 'SS', to: [-33, 115.5] }, { kind: 'run', who: '2B', to: 'second' }, { kind: 'run', who: 'CF', to: [-70, 182] },
          { kind: 'run', who: 'RF', to: [21, 66] }, { kind: 'run', who: '1B', to: 'first' }, { kind: 'run', who: '3B', to: 'third' }] },
        { say: 'The throw goes to second base, on a line through the cutoff.', moves: [{ kind: 'throw', to: '@2B', past: ['SS'] }] }
      ] },
      { name: 'Single to center', ball: 'home', hide: ['R'], steps: [
        { say: 'Single to center, nobody on: shortstop is the cutoff, second baseman covers second, left and right back up center, corners cover their bases.', moves: [
          { kind: 'ground', to: HIT_CENTER }, { kind: 'run', who: 'CF', to: HIT_CENTER }, { kind: 'run', who: 'SS', to: [14.1, 127.7] }, { kind: 'run', who: '2B', to: 'second' }, { kind: 'run', who: 'LF', to: [0, 204] },
          { kind: 'run', who: 'RF', to: [62, 196] }, { kind: 'run', who: '1B', to: 'first' }, { kind: 'run', who: '3B', to: 'third' }] },
        { say: 'The throw goes to second base, on a line through the cutoff.', moves: [{ kind: 'throw', to: '@2B', past: ['SS'] }] }
      ] },
      { name: 'Single to right', ball: 'home', hide: ['R'], steps: [
        { say: 'Single to right, nobody on: second baseman is the cutoff, shortstop covers second, center backs up right, left backs up the throw, corners cover their bases.', moves: [
          { kind: 'ground', to: HIT_RIGHT }, { kind: 'run', who: 'RF', to: HIT_RIGHT }, { kind: 'run', who: '2B', to: [33, 115.5] }, { kind: 'run', who: 'SS', to: 'second' }, { kind: 'run', who: 'CF', to: [70, 182] },
          { kind: 'run', who: 'LF', to: [-21, 66] }, { kind: 'run', who: '1B', to: 'first' }, { kind: 'run', who: '3B', to: 'third' }] },
        { say: 'The throw goes to second base, on a line through the cutoff.', moves: [{ kind: 'throw', to: '@SS', past: ['2B'] }] }
      ] },
      { name: 'Runner on first, single to right', ball: 'home', start: { '1B': HOLDING }, steps: [
        { say: 'Runner on first, single to right: shortstop is the cutoff to third, second baseman covers second, third baseman covers third, pitcher backs up third, center backs up right.', moves: [
          { kind: 'ground', to: HIT_RIGHT_LINE }, { kind: 'run', who: 'RF', to: HIT_RIGHT_LINE }, { kind: 'run', who: 'R', to: 'second', curve: -0.1 }, { kind: 'run', who: 'SS', to: [-6, 67] }, { kind: 'run', who: '2B', to: [7, 97] },
          { kind: 'run', who: '3B', to: 'third' }, { kind: 'run', who: 'P', to: [-63.2, 28.5] }, { kind: 'run', who: 'CF', to: [84, 172] }] },
        { say: 'The runner tries for third. The throw goes to third, on a line through the cutoff.', moves: [{ kind: 'run', who: 'R', to: SHORT_OF_3B }, { kind: 'throw', to: '@3B', past: ['SS', 'R'] }] }
      ] }
    ],
    note: VARIES
  },
  'lib-td-002': {
    field: 'open',
    actors: [f('OFa', [90, 44], 'OF'), f('RLa', [50, 44], 'Relay'), f('Ca', [10, 44], 'C'), f('OFb', [90, 16], 'OF'), f('RLb', [50, 16], 'Relay'), f('Cb', [10, 16], 'C')],
    marks: [{ at: [50, 55], text: 'about 150 ft, relay man halfway, all in line' }, { at: [50, 30], text: 'second team does the same' }],
    plays: [
      { name: 'The race', ball: '@OFa', steps: [
        { say: 'On go, the outfielder picks up a ball and throws to the relay man, who has his hands up and is yelling for it.', moves: [{ kind: 'throw', to: '@RLa' }] },
        { say: 'Relay man turns glove side and throws home.', moves: [{ kind: 'throw', to: '@Ca' }] },
        { say: 'Both teams go at once. First to get three balls home cleanly wins the round.', moves: [] }
      ] }
    ]
  },
  'lib-td-003': {
    field: 'infield',
    actors: [coach(HIT), ...INFIELD, run('R', 'first')],
    plays: [
      { name: 'Bunt, third base side', ball: 'home', hide: ['R'], steps: [
        { say: 'Coach rolls a bunt. Pitcher and both corners charge. Second baseman covers first, shortstop covers second.', moves: [
          { kind: 'ground', to: [-13, 19] }, { kind: 'run', who: '3B', to: [-13, 19] }, { kind: 'run', who: 'P', to: [-3, 31] }, { kind: 'run', who: '1B', to: [17, 24] },
          { kind: 'run', who: '2B', to: 'first' }, { kind: 'run', who: 'SS', to: 'second' }] },
        { say: 'Catcher yells the base. The fielder throws there.', moves: [{ kind: 'throw', to: '@2B' }] }
      ] },
      { name: 'Bunt, first base side', ball: 'home', hide: ['R'], steps: [
        { say: 'Coach rolls a bunt. Pitcher and both corners charge. Second baseman covers first, shortstop covers second.', moves: [
          { kind: 'ground', to: [14, 20] }, { kind: 'run', who: '1B', to: [14, 20] }, { kind: 'run', who: 'P', to: [3, 31] }, { kind: 'run', who: '3B', to: [-17, 24] },
          { kind: 'run', who: '2B', to: 'first' }, { kind: 'run', who: 'SS', to: 'second' }] },
        { say: 'Catcher yells the base. The fielder throws there.', moves: [{ kind: 'throw', to: '@2B' }] }
      ] },
      { name: 'Runner on first', ball: 'home', steps: [
        { say: 'Same coverage with a runner at first. The pitcher gets this one.', moves: [
          { kind: 'ground', to: [3, 25] }, { kind: 'run', who: 'P', to: [3, 25] }, { kind: 'run', who: '3B', to: [-17, 24] }, { kind: 'run', who: '1B', to: [19, 24] },
          { kind: 'run', who: '2B', to: 'first' }, { kind: 'run', who: 'SS', to: COVER_2B_SS }, { kind: 'run', who: 'R', to: 'second' }] },
        { say: 'Catcher decides between first and second and yells it. Shown: the throw to second.', moves: [{ kind: 'throw', to: '@SS' }] }
      ] }
    ],
    note: 'Everyone else backs up a base. Fielders stay out of the runner\'s lane to first.'
  },
  'lib-td-004': {
    field: 'infield',
    actors: [coach([26, -14]), ...INFIELD, run('R1', 'first', 'R1'), run('R3', 'third', 'R3')],
    plays: [
      { name: 'Throw through', ball: '@C', steps: [
        { say: 'Coach calls the option. On the pitch the runner at first goes. One middle infielder covers second; the other sets up in front of the bag, in line, ready to cut.', moves: [
          { kind: 'run', who: 'R1', to: 'second' }, { kind: 'run', who: 'SS', to: COVER_2B_SS }, { kind: 'run', who: '2B', to: [-4.6, 68] }] },
        { say: 'The runner at third stays, so the catcher throws through to second.', moves: [{ kind: 'throw', to: '@SS', past: ['P', '2B'] }] }
      ] },
      { name: 'Runner at third breaks', ball: '@C', steps: [
        { say: 'Coach calls the option. On the pitch the runner at first goes. One middle infielder covers second; the other sets up in front of the bag, in line, ready to cut.', moves: [
          { kind: 'run', who: 'R1', to: 'second' }, { kind: 'run', who: 'SS', to: COVER_2B_SS }, { kind: 'run', who: '2B', to: [-4.6, 68] }] },
        { say: 'Catcher throws toward second. The runner at third breaks, so the cut man takes the throw in front of the bag.', moves: [{ kind: 'throw', to: '@2B', past: ['P'] }, { kind: 'run', who: 'R3', to: [-21, 21] }] },
        { say: 'He throws home, ahead of the runner.', moves: [{ kind: 'throw', to: '@C', curve: -0.22, past: ['R3'] }, { kind: 'run', who: 'R3', to: [-9, 9] }] }
      ] },
      { name: 'Fake and look', ball: '@C', steps: [
        { say: 'Coach calls the option. On the pitch the runner at first goes.', moves: [{ kind: 'run', who: 'R1', to: 'second' }, { kind: 'run', who: 'SS', to: COVER_2B_SS }, { kind: 'run', who: '3B', to: COVER_3B }] },
        { say: 'Catcher fakes the throw to second and looks at third. The ball goes to third only if that runner has wandered off the base.', moves: [{ kind: 'throw', to: '@3B' }] }
      ] }
    ],
    note: 'Which middle infielder cuts and which covers is the coach\'s call. Grade it: did we get an out, or at least keep the run from scoring?'
  },
  'lib-td-005': {
    field: 'full',
    view: WIDE,
    actors: [coach(HIT_FAR), ...INFIELD, ...OUTFIELD, run('R', 'first')],
    plays: [
      { name: 'Ground ball to short', ball: 'home', hide: ['R'], steps: [
        { say: 'Coach hits a ground ball to short. First baseman goes to the bag. Who is behind first? The right fielder should already be moving.', moves: [{ kind: 'ground', to: '@SS' }, { kind: 'run', who: '1B', to: 'first' }, { kind: 'run', who: 'RF', to: [64, 30] }] },
        { say: 'Throw to first. The backup is behind the base, in line with the throw.', moves: [{ kind: 'throw', to: '@1B' }] }
      ] },
      { name: 'Hit to the outfield, throw to third', ball: 'home', start: { '1B': HOLDING }, steps: [
        { say: 'Coach hits to the outfield with a runner on. The throw is going to third. Who is behind third? The pitcher.', moves: [{ kind: 'ground', to: HIT_RIGHT_LINE }, { kind: 'run', who: 'RF', to: HIT_RIGHT_LINE }, { kind: 'run', who: 'R', to: 'second', curve: -0.1 }, { kind: 'run', who: '3B', to: 'third' }, { kind: 'run', who: '2B', to: [7, 97] }, { kind: 'run', who: 'P', to: [-63.2, 28.5] }] },
        { say: 'Throw to third. The pitcher is behind the base, in line with the throw.', moves: [{ kind: 'run', who: 'R', to: SHORT_OF_3B }, { kind: 'throw', to: '@3B', past: ['R'] }] }
      ] }
    ],
    note: 'The rule: if you are not in the play, you are backing up the base the ball is going to.'
  },
  'lib-td-008': {
    field: 'open',
    actors: [base('b1', [20, 33]), base('b2', [80, 33]), f('f1', [20, 24], '1'), f('f2', [80, 24], '2'), run('R', [50, 33]), f('f3', [8, 24], '3'), f('f4', [92, 24], '4')],
    marks: [{ at: [50, 50], text: 'bases 60 ft apart (45 ft for 8U and 9U)' }, { at: [50, 8], text: 'backups 10 ft behind each base' }],
    plays: [
      { name: 'One rundown', ball: '@f1', steps: [
        { say: 'Fielder with the ball runs hard at the runner, ball up in his throwing hand, to make him commit.', moves: [{ kind: 'run', who: 'f1', to: [42, 24] }, { kind: 'run', who: 'R', to: [58, 33] }] },
        { say: 'Receiver stays on the base side and calls now when he wants it. Short, firm toss.', moves: [{ kind: 'toss', to: '@f2' }] },
        { say: 'Receiver tags. Thrower follows his throw to back up. Goal: no more than two throws.', moves: [{ kind: 'run', who: 'f2', to: [65, 30] }, { kind: 'run', who: 'f1', to: [78, 22], curve: -0.16 }] }
      ] }
    ],
    note: 'Tag with the glove. Never throw at the runner.'
  },

  // ---------------------------------------------------------------- THROWING, PITCHING, CATCHING, HITTING
  'lib-thr-005': {
    field: 'open',
    actors: [f('a1', [20, 46], '1'), f('a2', [40, 46], '2'), f('a3', [60, 46], '3'), f('a4', [80, 46], '4'), f('b1', [20, 12], '1'), f('b2', [40, 12], '2'), f('b3', [60, 12], '3'), f('b4', [80, 12], '4')],
    marks: [{ at: [60, 29], text: '40 to 70 ft apart, by age' }, { at: [50, 55], text: '12 ft between pairs, all throwing the same direction' }],
    plays: [
      { name: 'Every pair', ball: '@a1', steps: [
        { say: 'Partner gives a chest target. A throw he catches without moving the glove more than a foot is a point.', moves: [{ kind: 'throw', to: '@b1', curve: 0.07 }] },
        { say: 'Ball to the throwing hand first, then step and throw back. Each pair counts out loud to 25.', moves: [{ kind: 'throw', to: '@a1', curve: 0.07 }] }
      ] }
    ],
    note: 'Every pair does the same at once. 40 ft for 8U, 50 ft for 10U, 60 to 70 ft for 12U and older.'
  },
  'lib-thr-006': {
    field: 'open',
    actors: [f('A', [8, 30], '1'), f('B', [38, 30], '2'), cone('k1', [38, 21]), cone('k2', [48, 21]), cone('k3', [58, 21]), cone('k4', [68, 21]), cone('k5', [78, 21]), cone('k6', [88, 21])],
    marks: [{ at: [38, 13], text: '45 ft' }, { at: [70, 13], text: 'a cone every 15 ft' }, { at: [50, 54], text: 'cap near 120 ft at 10U, 150 ft at 12U, 180 ft at 14U' }],
    plays: [
      { name: 'Out and back', ball: '@B', steps: [
        { say: 'Start at the first cone. Five throws there.', moves: [{ kind: 'throw', to: '@A' }] },
        { say: 'Move back one cone at a time, five throws at each. An arc is fine on the way out. Stop backing up the moment a throw needs real effort.', moves: [{ kind: 'run', who: 'B', to: [78, 30] }, { kind: 'fly', to: '@B' }] },
        { say: 'Come back in one cone at a time, five throws each, on a line. Finish at the first cone with easy throws.', moves: [{ kind: 'run', who: 'B', to: [38, 30], curve: 0.22 }] }
      ] }
    ],
    note: 'Only after a full warm-up. Stop the moment anything in the arm feels tight or sore.'
  },
  'lib-thr-011': {
    field: 'open',
    actors: [f('a1', [14, 45], '1'), f('a2', [38, 45], '2'), f('a3', [62, 45], '3'), f('a4', [86, 45], '4'), f('b1', [14, 15], '1'), f('b2', [38, 15], '2'), f('b3', [62, 15], '3'), f('b4', [86, 15], '4')],
    marks: [{ at: [50, 56], text: 'players 60 ft apart (40 ft for 10U and under)' }, { at: [50, 30], text: 'lines 30 ft apart; second team does the same' }],
    plays: [
      { name: 'Down and back', ball: '@a1', steps: [
        { say: 'On go, the ball travels down the line. Each player catches, transfers, and throws to the next chest.', moves: [{ kind: 'throw', to: '@a2', curve: 0.12 }, { kind: 'throw', to: '@a3', curve: 0.12 }, { kind: 'throw', to: '@a4', curve: 0.12 }] },
        { say: 'And back. A drop or a bad throw sends the ball back one player.', moves: [{ kind: 'throw', to: '@a3', curve: 0.12 }, { kind: 'throw', to: '@a2', curve: 0.12 }, { kind: 'throw', to: '@a1', curve: 0.12 }] },
        { say: 'First team to get the ball back to the start wins the round. Best of three.', moves: [] }
      ] }
    ]
  },
  'lib-pit-008': {
    field: 'infield',
    actors: [coach(HIT), f('P', 'P'), f('1B', '1B'), f('C', 'C')],
    plays: [
      { name: 'Comebacker', ball: '@P', steps: [
        { say: 'Pitcher throws an easy pitch (to a catcher or a net) and finishes square to the plate.', moves: [{ kind: 'throw', to: '@C' }] },
        { say: 'Then the coach hits one back at him. First baseman goes to the bag.', moves: [{ kind: 'ground', newBall: true, from: '@Co', to: '@P' }, { kind: 'run', who: '1B', to: 'first' }] },
        { say: 'Pitcher fields it and throws to first.', moves: [{ kind: 'throw', to: '@1B' }] }
      ] },
      { name: 'Cover first', ball: '@P', steps: [
        { say: 'Pitcher throws an easy pitch (to a catcher or a net) and finishes square to the plate.', moves: [{ kind: 'throw', to: '@C' }] },
        { say: 'Ground ball to the first baseman\'s right. Pitcher runs to cover first.', moves: [{ kind: 'ground', newBall: true, from: '@Co', to: [28, 66] }, { kind: 'run', who: '1B', to: [28, 66] }, { kind: 'run', who: 'P', to: 'first', curve: -0.2 }] },
        { say: 'First baseman tosses it to him. Pitcher touches the inside of the bag.', moves: [{ kind: 'toss', to: '@P' }] }
      ] },
      { name: 'Bunt, third base line', ball: '@P', steps: [
        { say: 'Pitcher throws an easy pitch (to a catcher or a net) and finishes square to the plate.', moves: [{ kind: 'throw', to: '@C' }] },
        { say: 'Bunt down the third base line. Pitcher gets to it. First baseman goes to the bag.', moves: [{ kind: 'ground', newBall: true, from: '@Co', to: [-15, 22] }, { kind: 'run', who: 'P', to: [-15, 22] }, { kind: 'run', who: '1B', to: 'first' }] },
        { say: 'Pitcher fields it and throws to first.', moves: [{ kind: 'throw', to: '@1B' }] }
      ] }
    ],
    note: 'Coach hits only after the pitcher has finished the pitch and is square to the plate.'
  },
  'lib-cat-005': {
    field: 'infield',
    actors: [coach([0, 35.5]), f('C', 'C'), f('SS', COVER_2B_SS), run('R', 'first')],
    marks: [{ at: [18, 14], text: '45 ft' }],
    plays: [
      { name: 'Catch and throw', ball: '@Co', hide: ['R'], steps: [
        { say: 'Coach throws from 45 ft. Catcher receives and gets the ball to his throwing hand at the chest.', moves: [{ kind: 'throw', to: '@C' }] },
        { say: 'Feet replace: right foot where the left was, left foot to the target. Throw knee high to the glove side of second.', moves: [{ kind: 'run', who: 'Co', to: [20, 35.5] }, { kind: 'throw', to: '@SS', curve: 0.16, past: ['Co'] }] }
      ] },
      { name: 'Last five: a runner goes', ball: '@Co', steps: [
        { say: 'A runner leaves on the pitch. Catcher receives and gets the ball to his throwing hand at the chest.', moves: [{ kind: 'throw', to: '@C' }, { kind: 'run', who: 'R', to: [21, 63.6] }] },
        { say: 'Feet replace and throw. Try to beat him to the bag.', moves: [{ kind: 'run', who: 'Co', to: [20, 35.5] }, { kind: 'throw', to: '@SS', curve: 0.16, past: ['Co'] }, { kind: 'run', who: 'R', to: 'second' }] }
      ] }
    ],
    note: 'A fielder covers second and stays off the base line. The coach steps aside after he throws.'
  },
  'lib-hit-004': {
    field: 'open',
    actors: [f('H', [18, 30], 'H'), { id: 'Scr', kind: 'screen', label: 'L-screen', at: [51, 30] }, coach([60, 30]), gear('Net', [93, 30], 'Net'), line([14, 9])],
    marks: [{ at: [34, 22], text: '15 ft' }],
    plays: [
      { name: 'Front toss', ball: '@Co', steps: [
        { say: 'Coach, fully behind the L-screen, shows the ball and tosses underhand with an easy arc. Hitter loads as the ball leaves the hand.', moves: [{ kind: 'toss', to: '@H', curve: 0.06, past: ['Scr'] }] },
        { say: 'Swing. Eight tosses, then the next hitter. Hit into a net or out onto the field.', moves: [{ kind: 'fly', to: '@Net', curve: 0.24 }] }
      ] }
    ],
    note: 'The screen sits slightly toward the hitter\'s open side. Coach stays fully behind it on every toss.'
  }
};

/** The picture for a drill, if it has one. A coach's own copy of a library drill keeps the original's picture. */
export function diagramFor(drill: { id: string; diagramId?: string }): DrillDiagram | undefined {
  return DIAGRAMS[drill.diagramId ?? drill.id] ?? DIAGRAMS[drill.id];
}
