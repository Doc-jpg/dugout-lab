/**
 * Dugout Lab drill extras.
 *
 * Coaching notes layered on top of the seed library in drills.ts: common mistakes with a fix,
 * a safety line only where a real one exists, a one-line way to make the drill competitive,
 * and spacing when the numbers matter. Keyed by drill id. Written for a volunteer coach to
 * read in a glance at the station.
 *
 * AUDIT_NOTES is the director's review of the library: only drills with a real problem,
 * one line each, naming the fix. Everything here is our own assessment, not quoted feedback.
 */

export interface DrillExtra {
  /** Common mistakes and the fix for each, 1 to 3 pairs, short. */
  mistakes?: Array<{ see: string; fix: string }>;
  /** One line, only when a real safety point exists (spacing, helmets, soft balls, arm care, sliding surface). */
  safety?: string;
  /** One line: how to make it competitive or game-like (score, clock, teams). */
  competitive?: string;
  /** Short spacing or dimensions when they matter ("45 ft between cones", "tee 10 ft from net"). */
  spacing?: string;
}

export const DRILL_EXTRAS: Record<string, DrillExtra> = {
  // -------------------------------------------------------------------------
  // HITTING
  // -------------------------------------------------------------------------
  'lib-hit-001': {
    mistakes: [
      { see: "Every ball goes to the same side no matter where the tee is.", fix: "Move the tee, then say the side out loud before the swing." },
      { see: "Hitter reaches for the outside ball with the arms.", fix: "Set the tee deeper and let the ball get to the back hip." },
      { see: "Hitter looks at the net, not the ball.", fix: "Eyes on the back of the ball until the bat hits it." }
    ],
    safety: "Partner stands behind the hitter's back shoulder, never in the swing or in front of the tee.",
    competitive: "Three balls in a row to the right side of the net earns a point; first hitter to five points wins.",
    spacing: "Tee 8 to 10 ft from the net. Tee spots about 8 in apart front to back."
  },
  'lib-hit-002': {
    mistakes: [
      { see: "Hitter falls toward the pitcher after the swing.", fix: "Slow the swing down until the finish holds, then speed up." },
      { see: "Back foot never turns.", fix: "Squash the bug with the back foot before the bat gets to the ball." },
      { see: "Head pulls out toward the net.", fix: "Keep the nose pointed at the tee until the swing is done." }
    ],
    safety: "Partner stands behind the hitter's back shoulder, out of the swing path.",
    competitive: "Count how many swings in a row freeze clean; the longest streak at the station wins.",
    spacing: "Tee 8 to 10 ft from the net."
  },
  'lib-hit-003': {
    mistakes: [
      { see: "Hitter swings the same way for every call.", fix: "Go back to the tee ladder and move the tee for each call." },
      { see: "Hitter cheats by waiting to hear the call before loading.", fix: "Make the call during the load, not before." }
    ],
    safety: "Partner stands behind the hitter's back shoulder, out of the swing path.",
    competitive: "Score out of ten; the hitter who beats his last score by two gets to call the directions next round.",
    spacing: "Tee 8 to 10 ft from the net; three marks on the net about 3 ft apart."
  },
  'lib-hit-004': {
    mistakes: [
      { see: "Hitter loads before the ball leaves the hand and is stuck waiting.", fix: "Say load out loud as the ball leaves the hand." },
      { see: "Hitter lunges at the toss.", fix: "Softer toss with more arc so he has time to wait." },
      { see: "Coach tosses too flat.", fix: "Toss with a little arc so it drops into the zone." }
    ],
    safety: "Coach stays fully behind the L-screen on every toss.",
    competitive: "Count squared-up balls out of eight; a hitter who gets six wins the round.",
    spacing: "L-screen 15 ft in front of the plate, slightly toward the hitter's open side."
  },
  'lib-hit-005': {
    mistakes: [
      { see: "Hitter pulls everything.", fix: "Three outside tosses in a row until he lets one travel." },
      { see: "Hitter calls the location after seeing where it went.", fix: "Call it right at contact, not after." }
    ],
    safety: "Coach stays fully behind the L-screen on every toss.",
    competitive: "Two points when the hitter names the spot and hits to the matching field; most points after ten wins.",
    spacing: "L-screen about 12 ft from the plate."
  },
  'lib-hit-006': {
    mistakes: [
      { see: "Hitter guesses fast every time and is way out front on the slow one.", fix: "Three slow tosses in a row until the hands wait." },
      { see: "Hitter changes his swing for the slow one.", fix: "Same swing, longer wait; hold the hands back, not the whole body." }
    ],
    safety: "Coach stays fully behind the L-screen on every toss.",
    competitive: "One point for a hard ball to the field the pitch calls for; first to five on the mixed round wins.",
    spacing: "L-screen about 20 ft from the plate, or machine at the age distance."
  },
  'lib-hit-007': {
    mistakes: [
      { see: "Hitter stabs or pushes at the ball and it pops up.", fix: "Catch it with the bat; let the ball hit the bat." },
      { see: "Bat below the hands on a low pitch.", fix: "Bend the knees to get down; the bat stays above the hands." },
      { see: "Bunt rolls foul.", fix: "Angle the bat head toward the cone before the toss." }
    ],
    competitive: "A bunt that dies inside the cones is one point, inside a 5 ft circle around the cone is two; first to seven wins.",
    spacing: "Cones 15 ft up each foul line. L-screen about 20 ft from the plate."
  },
  'lib-hit-008': {
    mistakes: [
      { see: "Hitter still takes a full swing with two strikes.", fix: "Choke up a full hand width and widen the feet before the toss." },
      { see: "Hitter takes a close pitch and gets rung up.", fix: "Anything close gets a swing; the coach calls close pitches strikes." }
    ],
    safety: "Coach stays behind the L-screen; fielders stay at normal depth and wear gloves.",
    competitive: "Already a game to ten; add a team split so one side hits while the other fields and keeps score.",
    spacing: "L-screen about 20 ft from the plate; net 15 ft if indoors."
  },
  'lib-hit-009': {
    mistakes: [
      { see: "Hitter says the plan but swings at everything anyway.", fix: "Count only decisions; a swing on a bad pitch in a hitter's count costs a point." },
      { see: "Coach tosses nothing but strikes.", fix: "One in three tosses should be off the plate." }
    ],
    safety: "Coach stays fully behind the L-screen on every toss.",
    competitive: "Good decision is a point, bad decision minus one; first hitter to eight wins.",
    spacing: "L-screen about 20 ft from the plate."
  },
  'lib-hit-010': {
    mistakes: [
      { see: "Hitter rolls over and pulls the outside pitch.", fix: "Let it travel past the front foot before the hands go." },
      { see: "Hitter drags the bat and pokes it weakly.", fix: "Stay through the ball; finish high toward the opposite gap." }
    ],
    safety: "Coach stays fully behind the L-screen on every toss.",
    competitive: "Hard ball to the opposite side is two points, middle is one; most points after ten wins.",
    spacing: "L-screen 15 to 20 ft from the plate; net angled toward the opposite field indoors."
  },
  'lib-hit-011': {
    mistakes: [
      { see: "Hands go first and the hips never turn.", fix: "Pause at the load, then turn the belly button before the hands move." },
      { see: "Hitter leans back and stays on the back leg.", fix: "Weight moves into a firm front leg as the hips turn." }
    ],
    safety: "Coach watches from behind the hitter's back shoulder, out of the swing path.",
    competitive: "Coach calls clean when the back foot turns and the head stays still; ten clean swings in a row wins the station.",
    spacing: "Tee 10 ft from the net."
  },
  'lib-hit-012': {
    mistakes: [
      { see: "Hitter swings harder instead of shorter and is late anyway.", fix: "Half-speed swing that is on time, then build up." },
      { see: "Big leg kick or long stride eats the time.", fix: "Feet set, small stride or no stride." }
    ],
    safety: "Coach is fully behind a full-size L-screen; move back to 15 ft for 13U and older hitters.",
    competitive: "On-time contact is a point; first to six out of eight wins and picks the next drill.",
    spacing: "L-screen 10 to 12 ft from the plate, 15 ft for older hitters."
  },
  'lib-hit-013': {
    mistakes: [
      { see: "Hitter drifts forward on the slow pitch.", fix: "Stay in the legs; the front foot lands and waits." },
      { see: "Hitter reports late when he was early.", fix: "Coach says what he saw after the hitter's call so the read gets honest." }
    ],
    safety: "Coach stays behind the L-screen; nobody loads the machine while a hitter is in the box.",
    competitive: "Correct speed call is one point, hard contact on the slow one is two; most points after ten wins.",
    spacing: "Machine at the age distance: 46 ft for 12U and under, 54 ft for 13U, 60 ft 6 in for 14U."
  },
  'lib-hit-014': {
    mistakes: [
      { see: "Hitter says the job, then swings for a home run.", fix: "A big swing in a move-the-runner spot costs the point even on a hit." },
      { see: "Runners stand and watch.", fix: "Runners must react on every pitch or the rep is done again." }
    ],
    safety: "Coach behind the L-screen; runners wear helmets; fielders throw to bases, never at runners.",
    competitive: "Already scored on job done; split into two teams and play to ten jobs done."
  },
  'lib-hit-015': {
    mistakes: [
      { see: "Hitter calls the zone and swings for distance.", fix: "Call it, then take a normal swing; distance points are a bonus." },
      { see: "Waiting hitters creep up toward the tee.", fix: "Set a cone 20 ft back for the on-deck line." }
    ],
    safety: "One hitter at the tee at a time; everyone else behind the on-deck cone with bats down.",
    competitive: "Already a points game; add a team total so the quiet kids' points count too.",
    spacing: "Zones about 30 ft wide. Long-ball cone 100 to 150 ft out depending on age."
  },
  'lib-hit-016': {
    mistakes: [
      { see: "Hitter tries to muscle up after dropping a rung.", fix: "Say next pitch out loud and swing at normal effort." },
      { see: "Window is so small nobody climbs.", fix: "Widen the tape until most hitters climb at least once a turn." }
    ],
    safety: "Coach stays fully behind the L-screen on every toss.",
    competitive: "Already a ladder race; add a team ladder where the whole group has to climb together.",
    spacing: "L-screen about 20 ft from the plate; window about 3 ft by 3 ft at chest height."
  },

  // -------------------------------------------------------------------------
  // THROWING
  // -------------------------------------------------------------------------
  'lib-thr-001': {
    mistakes: [
      { see: "Players skip to hard throws by the second stage.", fix: "Coach or leader calls each stage; nobody moves ahead." },
      { see: "Wrist flips come from the whole arm.", fix: "Glove hand holds the throwing elbow up; only the wrist moves." },
      { see: "Pairs back up farther than their arm is ready for.", fix: "Set the far distance by age and keep everyone at it." }
    ],
    safety: "Everyone throws the same direction in one line; nobody walks between pairs.",
    competitive: "Last stage: first pair to ten chest-high catches in a row wins the warm-up.",
    spacing: "Start 10 ft apart; finish at 40 ft for 10U and under, 60 ft for 12U and older. Pairs 12 ft apart side to side."
  },
  'lib-thr-002': {
    mistakes: [
      { see: "Fingers along the seams instead of across them.", fix: "Find the horseshoe first, then lay two fingers across it." },
      { see: "Ball jammed back in the palm.", fix: "Slide a finger in the gap; it should fit." }
    ],
    competitive: "Time the group; every player must show a correct grip before the clock stops, and try to beat the time.",
  },
  'lib-thr-003': {
    mistakes: [
      { see: "Elbow drops below the shoulder.", fix: "Point the glove, then throw with the elbow at shoulder height." },
      { see: "Player sits back on his heel and throws uphill.", fix: "Chest leans toward the partner at release." }
    ],
    competitive: "Chest-high catch is a point; first pair to twelve wins.",
    spacing: "Partners 20 ft apart."
  },
  'lib-thr-004': {
    mistakes: [
      { see: "Front foot lands sideways or closed.", fix: "Toes point at the partner before the throw starts." },
      { see: "Step is too long and the player falls off line.", fix: "Move the cone in until the step is comfortable." }
    ],
    competitive: "A throw counts only if the foot hits the cone; first pair to ten counted throws wins.",
    spacing: "Partners 30 to 40 ft apart; cone about one stride in front of the back foot."
  },
  'lib-thr-005': {
    mistakes: [
      { see: "Throws fly all over because nobody gives a target.", fix: "Glove up at the chest before the partner throws." },
      { see: "Pairs stop counting after a few throws.", fix: "Loudest counting pair gets to pick the next game." }
    ],
    safety: "All pairs throw the same direction with 12 ft between pairs.",
    competitive: "Race: first pair to 25 points wins; losers do five tuck jumps.",
    spacing: "40 ft for 8U, 50 ft for 10U, 60 to 70 ft for 12U and older."
  },
  'lib-thr-006': {
    mistakes: [
      { see: "Player backs up until the throws bounce.", fix: "Stop at the last cone where the ball still gets there in the air with an easy arm." },
      { see: "Come-back-in throws are lobbed.", fix: "On a line to the chest coming in, less distance, same easy effort." },
      { see: "Long toss right after a bullpen or a game.", fix: "Not on a pitching day; keep this to a fresh arm." }
    ],
    safety: "Only after a full warm-up; stop the moment anything in the arm feels tight or sore.",
    competitive: "On the way in, a throw that hits the chest without the glove moving is a point; first pair to ten wins.",
    spacing: "Cones every 15 ft starting at 45 ft. Cap near 120 ft for 10U, 150 ft for 12U, 180 ft for 14U."
  },
  'lib-thr-007': {
    mistakes: [
      { see: "Player catches one-handed off to the side.", fix: "Two hands, glove to the chest, ball out right away." },
      { see: "Player speeds up the throw and sprays it.", fix: "Fast transfer, normal throw." }
    ],
    competitive: "Leader counts; a transfer finished inside one count is a point, first pair to fifteen wins.",
    spacing: "Partners 30 ft apart."
  },
  'lib-thr-008': {
    mistakes: [
      { see: "Player stops, sets, and then throws.", fix: "Feet keep moving through the second cone; no stop allowed." },
      { see: "Long arm swing on the run.", fix: "Ball stays under the chin, short arm, quick release." }
    ],
    competitive: "Catchable at the chest is a point; six of eight wins the round, then add a runner race.",
    spacing: "Cones 15 ft apart; target partner 50 ft from the second cone."
  },
  'lib-thr-009': {
    mistakes: [
      { see: "Players throw hard before they are warm.", fix: "Run the warm-up progression first; this is not the first throw of the day." },
      { see: "Pairs argue about the score.", fix: "Catcher scores every throw out loud, no debate." }
    ],
    safety: "Arms must be warm first; all pairs throw the same direction with 12 ft between them.",
    competitive: "Already a game to 21; run a bracket so winning pairs play each other.",
    spacing: "40 ft for 8U, 50 ft for 10U, 60 ft for 12U and older."
  },
  'lib-thr-010': {
    mistakes: [
      { see: "Hop goes straight up instead of toward the target.", fix: "Hop low and long toward the partner." },
      { see: "Player hops before the catch.", fix: "Catch first, then hop; say catch, hop, throw." }
    ],
    competitive: "Throw that reaches the partner on a line with the hop on the cone is a point; first to eight wins.",
    spacing: "Start at 50 ft, build to 70 ft. Hop cone 2 to 3 ft in front of the catch spot."
  },
  'lib-thr-011': {
    mistakes: [
      { see: "Players rush and throw at the next player's feet.", fix: "Chest only; a throw at the feet goes back one player." },
      { see: "Players turn the wrong way after the catch.", fix: "Turn glove side every time." }
    ],
    safety: "Lines 30 ft apart so a bad throw from one line cannot reach the other.",
    competitive: "Already a race; add a round where every player must call the next player's name before he throws.",
    spacing: "Players 60 ft apart, 40 ft for 10U and under. Lines 30 ft apart."
  },

  // -------------------------------------------------------------------------
  // CATCHING
  // -------------------------------------------------------------------------
  'lib-cat-001': {
    mistakes: [
      { see: "Glove snaps shut before the ball arrives.", fix: "Glove open and still, let the ball come in." },
      { see: "Fingers up on a low ball.", fix: "Below the waist, fingers point at the ground." },
      { see: "Catcher jumps at the ball with stiff arms.", fix: "Arms out, then pull the ball in like catching an egg." }
    ],
    competitive: "Two-handed catches are a point; first pair to twenty wins.",
    spacing: "Partners 15 ft apart."
  },
  'lib-cat-002': {
    mistakes: [
      { see: "Player backs up under the ball and catches at the waist.", fix: "Glove above the eyes, thumbs together." },
      { see: "No call.", fix: "No got it, no catch; do it again." }
    ],
    competitive: "Catch with two hands plus a loud call is a point; first player to eight wins.",
    spacing: "Coach 20 ft from the line; next player waits 10 ft behind."
  },
  'lib-cat-003': {
    mistakes: [
      { see: "Glove jerks toward the middle after the catch.", fix: "Catch it and freeze for one count; a pull does not count." },
      { see: "Catcher reaches out and stabs.", fix: "Relaxed glove, let the ball come to it, beat it to the spot with a small move." }
    ],
    safety: "Full gear including the mask; soft balls until the catcher is receiving clean.",
    competitive: "Stuck is a point, pulled is zero; beat last practice's score out of thirty.",
    spacing: "Thrower at 30 ft; move to 45 ft for the harder version."
  },
  'lib-cat-004': {
    mistakes: [
      { see: "Catcher tries to catch the ball instead of blocking it.", fix: "Glove fills the hole and stays there; chest does the work." },
      { see: "Chin up, ball hits the throat area.", fix: "Chin down to the chest before the ball arrives." },
      { see: "Catcher falls backward.", fix: "Lean forward so the ball dies in front." }
    ],
    safety: "Full gear with cup and mask; tennis or soft balls first, real baseballs only once the shape is right.",
    competitive: "Ball that stops within a step is a point; first catcher to eight wins the round.",
    spacing: "Coach 20 ft away."
  },
  'lib-cat-005': {
    mistakes: [
      { see: "Catcher stands all the way up before throwing.", fix: "Replace the feet and throw from a low, athletic base." },
      { see: "Throw sails high over the bag.", fix: "Aim at the fielder's knee on the glove side." }
    ],
    safety: "Full gear; a live runner slides feet first only once sliding has been taught, and the fielder stays off the base line.",
    competitive: "Catchable at the bag is a point; add a runner for the last five and count wins against him.",
    spacing: "Coach 45 ft from the catcher; second base at the age distance."
  },
  'lib-cat-006': {
    mistakes: [
      { see: "Mask comes off before the ball is found.", fix: "Find it first, then lose the mask." },
      { see: "Catcher tosses the mask where the ball is landing.", fix: "Throw the mask the opposite way from the ball." }
    ],
    safety: "Clear bats, balls and helmets from behind the plate before the first pop-up.",
    competitive: "Catch with the mask thrown clear is a point; most out of ten wins.",
  },
  'lib-cat-007': {
    mistakes: [
      { see: "Catcher sets the target late and the pitcher waits.", fix: "Target up before the pitcher comes set." },
      { see: "Catcher says nothing after a pitch.", fix: "One word every pitch, even a good one." }
    ],
    safety: "The pitcher's 25 pitches count as a bullpen toward his daily limit.",
    competitive: "Pitcher scores the catcher: a point for every pitch with a target up early and a word after.",
    spacing: "Game distance for the age group."
  },

  // -------------------------------------------------------------------------
  // PITCHING
  // -------------------------------------------------------------------------
  'lib-pit-001': {
    mistakes: [
      { see: "Player leans back toward second base at the top.", fix: "Head stays over the back foot, chest tall." },
      { see: "Knee only comes up to the waist.", fix: "Lift the knee to belt height or higher and hold." }
    ],
    competitive: "Hold the balance point for a partner's count of three; first player to five clean holds wins.",
    spacing: "Players 6 ft apart in the line."
  },
  'lib-pit-002': {
    mistakes: [
      { see: "Landing foot misses the cone to the open side.", fix: "Stride straight at the plate cone; check the foot before the next rep." },
      { see: "Player finishes standing up straight.", fix: "Chest over the front knee, glove tucked, ready to field." }
    ],
    competitive: "Foot on the cone plus a balanced finish is a point; first pitcher to eight wins.",
    spacing: "Landing cone about five of the pitcher's own shoe lengths from the rubber, in line with the plate cone."
  },
  'lib-pit-003': {
    mistakes: [
      { see: "Effort creeps up as the score matters.", fix: "Coach calls easy after any pitch that looks like a max throw; it does not count." },
      { see: "Pitcher aims and steers the ball.", fix: "Pick the spot, then throw through it with the normal motion." }
    ],
    safety: "Every pitch counts toward the daily limit; stop at any arm pain.",
    competitive: "Already scored; keep a weekly leaderboard of best score out of sixty.",
    spacing: "Age pitching distance; zone taped 17 in wide from the knees to the letters, split into four boxes."
  },
  'lib-pit-004': {
    mistakes: [
      { see: "Pitcher starts the bullpen cold.", fix: "Full catch warm-up first, then the counted pitches." },
      { see: "Nobody writes the count down.", fix: "Coach logs every bullpen in the app before leaving the station." }
    ],
    safety: "Count every pitch toward the daily Pitch Smart limit; no bullpen the day after a start.",
    competitive: "Simulated at-bat round: catcher calls the count and scores a point for every pitch to the called spot.",
    spacing: "Game distance for the age group."
  },
  'lib-pit-005': {
    mistakes: [
      { see: "Pitcher nibbles for corners on 0-0.", fix: "First pitch goes to the biggest part of the glove." },
      { see: "After ball one the pitcher rushes.", fix: "Step off, breathe, say new count, then go." }
    ],
    safety: "Every pitch counts toward the daily limit; cap at 20 pitches per pitcher and skip it on a bullpen day.",
    competitive: "Already scored; each pitcher chases his own best score, not a teammate's.",
    spacing: "Game distance for the age group."
  },
  'lib-pit-006': {
    mistakes: [
      { see: "Elbow drifts away from the side on rotations.", fix: "Tuck a glove or a towel under the arm and hold it there." },
      { see: "Reps get fast and jerky.", fix: "Two seconds out, two seconds back." }
    ],
    safety: "Lightest band only, never a heavy one; stop at any pinch or pain.",
    competitive: "Partner counts clean reps; a rep with the elbow leaving the side does not count.",
    spacing: "One arm's length from the fence or partner so the band has light tension at the start."
  },
  'lib-pit-007': {
    mistakes: [
      { see: "Pitcher holds the same count every time.", fix: "Coach calls the hold count behind the runner's back until it varies on its own." },
      { see: "Pickoff throw is a max-effort throw at the runner.", fix: "Easy throw to the first baseman's glove at knee height, bag side." }
    ],
    safety: "Runner wears a helmet and gets back feet first or standing; no headfirst dives until taught.",
    competitive: "Runner gets a point for a correct guess, pitcher gets a point when the runner is frozen; first to six wins.",
    spacing: "Game distance; runner's lead marked at 2 to 3 steps."
  },
  'lib-pit-008': {
    mistakes: [
      { see: "Pitcher watches the ball instead of running to first.", fix: "Say cover on contact and go; the first baseman does the rest." },
      { see: "Pitcher steps on the middle of the bag.", fix: "Inside corner with the right foot, then turn in." }
    ],
    safety: "Coach hits the comebacker only after the pitcher has finished the pitch and is square to the plate.",
    competitive: "Right first move plus a catchable throw is a point; first pitcher to eight wins.",
  },
  'lib-pit-009': {
    mistakes: [
      { see: "Effort climbs to game speed.", fix: "If the partner's glove pops, slow it down." },
      { see: "Pitcher cuts the ball with the fingers off to the side.", fix: "Fingers behind the ball at release; partner calls true or cut." }
    ],
    safety: "Fifteen throws counted toward the day's throwing; this is not a second bullpen.",
    competitive: "True flight to the chest is a point; twelve of fifteen wins the station.",
    spacing: "About three quarters of game distance: 35 ft for 46 ft pitchers, 45 ft for 60 ft pitchers."
  },

  // -------------------------------------------------------------------------
  // INFIELD
  // -------------------------------------------------------------------------
  'lib-inf-001': {
    mistakes: [
      { see: "Glove starts high and chases the ball down.", fix: "Glove on the ground before the roll." },
      { see: "Ball is fielded under the body.", fix: "Reach out front; the ball should be seen into the glove." }
    ],
    competitive: "Clean field with the glove starting on the ground is a point; first pair to twenty wins.",
    spacing: "Partners 15 ft apart."
  },
  'lib-inf-002': {
    mistakes: [
      { see: "Fielder backs up on the hop.", fix: "Go get it; the glove moves toward the ball." },
      { see: "Flip lands too close and is a true short hop every time.", fix: "Bounce the ball 3 to 4 ft out so the fielder can reach it." }
    ],
    competitive: "Clean short hops are a point; first pair to fifteen wins.",
    spacing: "Partners 15 ft apart; bounce 3 to 4 ft in front of the glove."
  },
  'lib-inf-003': {
    mistakes: [
      { see: "Backhand with the glove under the ball and the elbow down.", fix: "Turn the glove over, elbow up, catch it out front." },
      { see: "Forehand fielded on the wrong foot.", fix: "Plant the back foot, then field." }
    ],
    competitive: "Clean field plus a chest-high throw is a point; first fielder to eight on the mixed round wins.",
    spacing: "Coach 40 ft away; cones 10 ft to each side of the fielder."
  },
  'lib-inf-004': {
    mistakes: [
      { see: "Fielder throws flat-footed from where he fielded it.", fix: "Say right, left, throw out loud for every rep." },
      { see: "Ball never comes to the middle.", fix: "Funnel to the belly button before the feet move." }
    ],
    competitive: "On-target throw with the feet moving is a point; first fielder to eight wins.",
    spacing: "Coach 40 ft away; target at the base distance, 60 ft for 12U and under, 70 to 90 ft older."
  },
  'lib-inf-005': {
    mistakes: [
      { see: "Shortstop fakes a throw or short-arms the feed.", fix: "Show the ball, then a firm throw to the chest." },
      { see: "Underhand flip has the glove hiding the ball.", fix: "Glove hand comes out, ball visible, stiff wrist." }
    ],
    safety: "A runner, if used, slides to the back of the bag; the receiver clears the base after the throw.",
    competitive: "Chest-high feed is a point; the pair with the most out of ten wins.",
    spacing: "Fielders at normal depth; coach near the mound."
  },
  'lib-inf-006': {
    mistakes: [
      { see: "Receiver stands on the bag waiting.", fix: "Set up behind the bag and come to the ball." },
      { see: "Receiver throws across the runner's path.", fix: "Touch, then get off the base to the back or the inside." }
    ],
    safety: "Live runners only after sliding has been taught; the runner slides feet first to the back of the bag.",
    competitive: "Coach times each turn; best turn time of the day wins, then try to beat it next week.",
    spacing: "Feeder 30 ft away; first base or net at the age distance."
  },
  'lib-inf-007': {
    mistakes: [
      { see: "Fielder waits for the ball to come to him.", fix: "First step is a sprint; charge from the crack of the bat." },
      { see: "Fielder stops to throw.", fix: "Field it off the front foot and throw on the run." },
      { see: "Bare hand on a ball that is still rolling.", fix: "Glove if it moves, bare hand only if it has stopped." }
    ],
    safety: "One ball live at a time; the next fielder waits until the throw is caught.",
    competitive: "Throw beats a runner, a point; add a real runner for the last three and keep score.",
    spacing: "Rollers stop 20 to 40 ft from home."
  },
  'lib-inf-008': {
    mistakes: [
      { see: "Fielder backpedals and falls.", fix: "Turn, run to the spot, then turn back." },
      { see: "Two players call it and stop.", fix: "Whoever calls last is wrong; the first loud call takes it." }
    ],
    safety: "With two fielders, the call decides; nobody dives in the gap.",
    competitive: "Clean catch plus a loud call is a point; most out of ten wins.",
  },
  'lib-inf-009': {
    mistakes: [
      { see: "Fielder calls the base after fielding the ball.", fix: "Say it before the ball gets there or the rep does not count." },
      { see: "Everyone goes for the lead runner.", fix: "Sure out first; the fancy play costs a point." }
    ],
    competitive: "Right call plus a throw to that base is a point; first fielder to eight wins.",
  },
  'lib-inf-010': {
    mistakes: [
      { see: "Fielder stands up as the ball gets ugly.", fix: "Stay low, chest over the ball." },
      { see: "Fielder flinches and turns his head.", fix: "Tennis balls only until the eyes stay on it." }
    ],
    safety: "Tennis or soft balls only for 12U and under; no baseballs off a wall at the face.",
    competitive: "Already scored; run a bracket and let the champ pick the next game.",
    spacing: "Coach 15 to 20 ft away; fielder 8 ft from the wall indoors."
  },
  'lib-inf-011': {
    mistakes: [
      { see: "Fielder rounds too wide and gets to the ball late.", fix: "Small round, just enough to get the momentum toward first." },
      { see: "Fielder stops after the catch to throw.", fix: "Feet keep moving; the throw comes from the second step." }
    ],
    competitive: "Throw that beats the runner is a point; first to six out of eight wins.",
  },
  'lib-inf-012': {
    mistakes: [
      { see: "Fielders rush and boot easy balls.", fix: "Say clean beats fast; a clean rep is worth more than a fast one." },
      { see: "Two balls in the air at once.", fix: "One coach hits, the other times; never both hitting at the same time." }
    ],
    safety: "One ball in play at a time; the second coach keeps time, he does not hit.",
    competitive: "Already timed; post the best time and play for it every week.",
  },
  'lib-inf-013': {
    mistakes: [
      { see: "Player throws, then gets into his stance.", fix: "Ready before the ball comes back." },
      { see: "Player stands too close and the ball comes back too fast.", fix: "Back up to 10 to 15 ft." }
    ],
    safety: "Players spaced 10 ft apart so nobody fields another player's rebound.",
    competitive: "Clean fields out of 50; beat your own number from last practice.",
    spacing: "Players 10 ft apart along the wall, 10 to 15 ft from it."
  },

  // -------------------------------------------------------------------------
  // OUTFIELD
  // -------------------------------------------------------------------------
  'lib-of-001': {
    mistakes: [
      { see: "Player drops the wrong foot and crosses over.", fix: "Drop the foot on the side the ball is going; say that side out loud." },
      { see: "Player backpedals.", fix: "Hips open, turn and run; no backpedaling allowed." }
    ],
    competitive: "Correct foot plus a catch is a point; first to six out of eight wins.",
    spacing: "Coach 20 ft from the line; players 6 ft apart in the line."
  },
  'lib-of-002': {
    mistakes: [
      { see: "Player curves toward the ball as he runs.", fix: "Pick the cone, run straight, then settle." },
      { see: "First step is a hop in place.", fix: "First step is the biggest one, toward the cone." }
    ],
    competitive: "Straight route plus a catch is a point; six of eight wins.",
    spacing: "Target cones 40 to 60 ft from the start cone."
  },
  'lib-of-003': {
    mistakes: [
      { see: "Player fields the ball under his body and stops.", fix: "Outside the glove-side foot, moving through it." },
      { see: "Throw sails over the cutoff.", fix: "Low and hard through the cutoff's head." }
    ],
    safety: "Warm arm first; six reps is the cap, this is a high-effort throw.",
    competitive: "Throw on a line to the cutoff is a point; first outfielder to four wins the round.",
    spacing: "Outfielder at normal depth for the age; cutoff 40 to 50 ft in front of home."
  },
  'lib-of-004': {
    mistakes: [
      { see: "Both players call it at once.", fix: "Center fielder wins ties; the other says you, you, you." },
      { see: "Call comes after the ball is on the way down.", fix: "Call it before the ball reaches its peak." }
    ],
    safety: "Once called off, the other player stops; no two players diving at one ball.",
    competitive: "A rep with one early call and a catch is a point; the pair that gets ten first wins.",
    spacing: "Outfielders 60 ft apart; coach 80 to 100 ft in front."
  },
  'lib-of-005': {
    mistakes: [
      { see: "Player catches flat-footed and then hops.", fix: "Get behind the ball so the catch happens moving forward." },
      { see: "Big rainbow throw.", fix: "Throw through the partner's chest on a line, one hop is fine." }
    ],
    competitive: "Throw that reaches the partner in the air or on one hop without him moving is a point; six of eight wins.",
    spacing: "90 to 120 ft, 60 ft for 10U and under."
  },
  'lib-of-006': {
    mistakes: [
      { see: "Cutoff man stands still with his hands down.", fix: "Hands up, in line, yelling the base." },
      { see: "Outfielder throws over the cutoff on purpose.", fix: "Low through the head; if it reaches the base on one hop, that was perfect." }
    ],
    competitive: "Throw the cutoff can catch at the chest or above is a point; rotate roles and keep a team score.",
    spacing: "Cutoff about 40 to 50 ft from the base, in line with the outfielder."
  },
  'lib-of-007': {
    mistakes: [
      { see: "First step is in on every ball.", fix: "Freeze for one beat on contact, then go." },
      { see: "Player calls his read after he has moved.", fix: "Call it on the first step or the rep does not count." }
    ],
    competitive: "Right first step is a point; first outfielder to seven out of ten wins.",
  },
  'lib-of-008': {
    mistakes: [
      { see: "Infielder keeps going back after being called off.", fix: "Peel off, turn, and set up as the relay." },
      { see: "Outfielder waits to see if the infielder gets there.", fix: "Outfielder decides early and says it loud." }
    ],
    safety: "Once called off, the infielder stops and turns; no diving in the gap.",
    competitive: "A rep with one loud decision and a clean catch is a point; most out of ten wins.",
    spacing: "Infielder at normal depth; outfielder 60 ft behind him."
  },
  'lib-of-009': {
    mistakes: [
      { see: "Player fields it standing up and it rolls through.", fix: "Knee down, glove down, chest over." },
      { see: "Player blocks when a run is scoring.", fix: "Coach calls block or charge before the hit until the read is right." }
    ],
    competitive: "Kept in front is a point; ten for ten wins and the player explains block versus charge.",
    spacing: "Coach 80 ft from the outfielder."
  },
  'lib-of-010': {
    mistakes: [
      { see: "Players stop after a drop.", fix: "Finish the play; the throw points are still there." },
      { see: "Nobody calls the ball.", fix: "No call, no call point." }
    ],
    competitive: "Already a points game; losing team runs the bases once.",
  },

  // -------------------------------------------------------------------------
  // BASERUNNING
  // -------------------------------------------------------------------------
  'lib-br-001': {
    mistakes: [
      { see: "Runner crosses his feet on the secondary.", fix: "Shuffle, shuffle, land; feet never cross." },
      { see: "Lead is too big and he is picked off.", fix: "Lead you can dive or step back from, about two and a half steps." }
    ],
    safety: "Helmets on; get back standing or feet first unless diving back has been taught on grass.",
    competitive: "Runner gets a point for landing on the pitch and getting back on the pick; first to six wins.",
    spacing: "Lead about 8 to 10 ft, marked with a cone."
  },
  'lib-br-002': {
    mistakes: [
      { see: "Runner goes on a line drive and gets doubled off.", fix: "Freeze on the line drive, then read it." },
      { see: "Runner stands at the base on a fly ball.", fix: "Halfway with less than two outs, all out with two." }
    ],
    safety: "Runners wear helmets; fielders throw to bases, never at runners.",
    competitive: "Right read before the ball lands is a point; first runner to eight wins.",
  },
  'lib-br-003': {
    mistakes: [
      { see: "Runner makes a wide loop around second.", fix: "Swing out a few steps before the bag and touch the inside corner." },
      { see: "Runner looks at the ball, not the coach.", fix: "Find the coach halfway to third; he sees the ball for you." }
    ],
    safety: "Helmets on; fielders throw to the base, never at the runner.",
    competitive: "Tight turn plus following the coach is a point; first to five out of six wins.",
  },
  'lib-br-004': {
    mistakes: [
      { see: "Runner leaves before the catch.", fix: "Eyes on the glove, go when the ball hits it." },
      { see: "Runner watches the ball instead of the glove.", fix: "The glove tells you when; watch the glove." }
    ],
    safety: "Helmets on; feet-first slides at home only, catcher gives the lane.",
    competitive: "Right go-or-stay call plus a clean tag up is a point; first to five wins.",
  },
  'lib-br-005': {
    mistakes: [
      { see: "False step back before going.", fix: "Crossover step first, nothing else." },
      { see: "Runner guesses instead of reading the heel.", fix: "Say heel or foot out loud on every rep." }
    ],
    safety: "Helmets on; get back standing or feet first; sliding into second only after Sliding Basics.",
    competitive: "Good jump is a point, picked off is minus one; first to five wins.",
    spacing: "Lead of 2 to 3 steps marked with a cone."
  },
  'lib-br-006': {
    mistakes: [
      { see: "Runner slows down at first on a single.", fix: "Sprint through to the cone, break down after." },
      { see: "Runner touches the middle of the base on the round.", fix: "Inside corner with either foot." }
    ],
    safety: "Helmets on; one runner at a time on the bases.",
    competitive: "Time the full trip; beat your own time by one second with a tighter curve.",
    spacing: "Run-through cone 10 ft past first; curve cones 3 ft outside the line, 15 ft before each base."
  },
  'lib-br-007': {
    mistakes: [
      { see: "Player jumps into the slide and lands on the knee.", fix: "Sit down into it, land on the hip and thigh." },
      { see: "Hands drag on the ground.", fix: "Hands up, like holding two cups." },
      { see: "Slide starts too late and the foot hits the base hard.", fix: "Start a full body length early." }
    ],
    safety: "Wet grass, a tarp or a mat the first time, never dirt; no cleats on a tarp; no headfirst slides.",
    competitive: "Five clean slides in a row with hands up earns a stamp; first group all stamped wins.",
    spacing: "Slide lane at least 20 ft long with the base at the end; waiting players 10 ft to the side."
  },
  'lib-br-008': {
    mistakes: [
      { see: "Runner takes a small secondary with two outs.", fix: "Two outs, you are moving on contact; big secondary." },
      { see: "Runner slows to look for the coach.", fix: "Find the coach while running hard; never slow down to look." }
    ],
    safety: "Helmets on; feet-first slides at home and the catcher gives the lane; no collisions.",
    competitive: "Already scored; run it as offense versus defense to five.",
  },

  // -------------------------------------------------------------------------
  // TEAM DEFENSE
  // -------------------------------------------------------------------------
  'lib-td-001': {
    mistakes: [
      { see: "Players without a job stand still.", fix: "If you have nothing to do, back something up." },
      { see: "Cutoff man is in the wrong line.", fix: "Get between the outfielder and the base and put both hands up." }
    ],
    competitive: "Half-speed rep with all nine in the right spot and no pointing earns the team a point; three points wins the drill.",
  },
  'lib-td-002': {
    mistakes: [
      { see: "Relay man turns the wrong way.", fix: "Catch over the glove shoulder and turn glove side." },
      { see: "Relay man is silent.", fix: "Hands up, yell relay, relay." }
    ],
    competitive: "Already a race; add a point for every relay the catcher does not have to move for.",
    spacing: "Outfielder 150 ft from the base, relay man halfway, both in line."
  },
  'lib-td-003': {
    mistakes: [
      { see: "First base is empty when the throw comes.", fix: "Second baseman breaks to first on the bunt, every time." },
      { see: "Fielder throws before the catcher calls.", fix: "Catcher calls first; the fielder listens, then throws." }
    ],
    safety: "Helmet on the bunter; fielders stay out of the runner's lane to first.",
    competitive: "Call plus a throw to the called base with first covered is a point; first to six out of eight wins.",
  },
  'lib-td-004': {
    mistakes: [
      { see: "Catcher throws through without looking at third.", fix: "Look him back first, then throw." },
      { see: "Cutoff fielder stands on the bag.", fix: "Set up in front of the bag, in line, ready to cut." }
    ],
    safety: "Runners wear helmets and slide feet first; nobody throws at a runner.",
    competitive: "No run scores is a point for the defense, a run is a point for the runners; first to five wins.",
  },
  'lib-td-005': {
    mistakes: [
      { see: "Backup player stands 5 ft behind the base.", fix: "Back up deep, 20 to 30 ft behind the base, in line with the throw." },
      { see: "Pitcher watches the play from the mound.", fix: "Pitcher moves on every ball: third or home." }
    ],
    competitive: "On each deliberate overthrow, the backup who has the ball before the runner advances earns the team a point.",
  },
  'lib-td-006': {
    mistakes: [
      { see: "Two players call it, both stop.", fix: "Priority player calls first and loudest; everyone else peels off." },
      { see: "Pitcher tries to catch pop-ups on the mound.", fix: "Pitcher points and gets out of the way." }
    ],
    safety: "Once called off, stop and point; no diving in the gray areas.",
    competitive: "A pop-up with one clear owner and a catch is a point; ten for ten wins the drill.",
  },
  'lib-td-007': {
    mistakes: [
      { see: "Nobody says the situation before the pitch.", fix: "Catcher calls outs and runners out loud; the rep does not start until he does." },
      { see: "Defense goes for the lead runner every time.", fix: "Sure out first; the fancy play costs a point." }
    ],
    safety: "Helmets on runners; feet-first slides only; fielders throw to bases, never at runners.",
    competitive: "Already scored; beat last practice's score and post it.",
  },
  'lib-td-008': {
    mistakes: [
      { see: "Fielder pumps fakes and jogs at the runner.", fix: "Run him hard with the ball up; no fakes." },
      { see: "Receiver calls for the ball too early.", fix: "Call now when the runner is a few steps away and committed." },
      { see: "Thrower stands and watches after the throw.", fix: "Follow the throw and back up the base." }
    ],
    safety: "Tag with the glove, never throw at the runner; runner wears a helmet.",
    competitive: "Tag in two throws or fewer is a point for the defense; runner who draws three throws gets a point; first to six wins.",
    spacing: "Bases 60 ft apart, 45 ft for 8U and 9U; backups 10 ft behind each base."
  },

  // -------------------------------------------------------------------------
  // GAME SITUATIONS
  // -------------------------------------------------------------------------
  'lib-sit-001': {
    mistakes: [
      { see: "Fielder tags the base with a runner who is not forced.", fix: "Is the base behind him full? If not, tag the runner." },
      { see: "Players guess on the board.", fix: "Ask them to name the base behind the runner before answering." }
    ],
    competitive: "Board round in teams; the first team to raise the correct answer on five questions wins.",
  },
  'lib-sit-002': {
    mistakes: [
      { see: "Only the infield shows the outs.", fix: "Outfielders and catcher show fingers too, or the rep is done again." },
      { see: "Players show the outs and still make the wrong play.", fix: "Ask what the outs change before the next hit." }
    ],
    competitive: "Ten reps in a row with all nine correct earns the team a water break; any miss resets the count.",
  },
  'lib-sit-003': {
    mistakes: [
      { see: "Fielder throws home when the runner is already there.", fix: "Sure out first; the vote after the play tells him." },
      { see: "Players argue the vote.", fix: "One reason each, then the coach decides." }
    ],
    safety: "Helmets on runners; fielders throw to bases, never at runners.",
    competitive: "Sure out is a point; a missed sure out is minus one; beat last practice's team total.",
  },
  'lib-sit-004': {
    mistakes: [
      { see: "Infield disagrees and plays half in, half back.", fix: "They must agree out loud before the pitch; no agreement, no pitch." },
      { see: "Infield in, fielder throws to first anyway.", fix: "In means look the runner back, then throw home if he goes." }
    ],
    safety: "Helmets on the runner; throws home go to the catcher's glove, not at the runner.",
    competitive: "Reasonable call plus the matching throw is a point; six of eight wins.",
  },
  'lib-sit-005': {
    mistakes: [
      { see: "Runners hesitate on contact with two outs.", fix: "Say two outs, go on contact before every pitch." },
      { see: "Defense tries for the lead runner.", fix: "Easiest out anywhere ends the inning." }
    ],
    safety: "Coach behind the L-screen; helmets on all hitters and runners; feet-first slides only.",
    competitive: "Already offense versus defense to ten.",
  },
  'lib-sit-006': {
    mistakes: [
      { see: "Players forget the card by the second pitch.", fix: "Catcher repeats the card before every pitch." },
      { see: "Huddle turns into a lecture.", fix: "Thirty seconds, players talk, coach adds one sentence." }
    ],
    safety: "Coach behind the L-screen; helmets on all hitters and runners; feet-first slides only.",
    competitive: "Already a scored scrimmage; add a bonus point for a correct call the coach hears before the pitch.",
  },

  // -------------------------------------------------------------------------
  // ATHLETIC MOVEMENT
  // -------------------------------------------------------------------------
  'lib-ath-001': {
    mistakes: [
      { see: "Players sprint the first rep.", fix: "Jog, then build; the fast ones come last." },
      { see: "Lines bunch up and players stop.", fix: "Next player goes when the one ahead is 5 yd out." }
    ],
    competitive: "Last two build-ups are races in pairs on the coach's clap.",
    spacing: "Cones 20 yd apart; lines 5 yd apart."
  },
  'lib-ath-002': {
    mistakes: [
      { see: "Knee caves inward on the landing.", fix: "Knee over the toes; land soft and quiet." },
      { see: "Player sticks it with a hop.", fix: "Smaller hop until the landing is silent." }
    ],
    competitive: "Partner counts stuck landings; most out of ten wins.",
    spacing: "Arm's length between players."
  },
  'lib-ath-003': {
    mistakes: [
      { see: "Eyes on the ladder.", fix: "Eyes on the player ahead, feel the boxes." },
      { see: "Players race and step on the rungs.", fix: "Clean first, fast second; a rung stepped on means that rep is done again." }
    ],
    safety: "Flat, dry ground; the next player goes when the ladder is clear.",
    competitive: "Clean trip in the fastest time wins; a touched rung adds two seconds.",
    spacing: "Ladder 15 to 20 ft; next player waits 5 ft behind."
  },
  'lib-ath-004': {
    mistakes: [
      { see: "Player stands up on the first step.", fix: "Stay low for three steps; lean like you are falling forward." },
      { see: "False step backward on the crossover.", fix: "Crossover, no step back." }
    ],
    competitive: "Already races in pairs; run a ladder so winners race winners.",
    spacing: "Start and finish cones 10 yd apart, 20 yd for the harder version."
  },
  'lib-ath-005': {
    mistakes: [
      { see: "Player stops tall and his feet slide.", fix: "Sink the hips, short choppy steps." },
      { see: "Player takes five steps to stop.", fix: "Mark the stop zone with a cone; stop inside it." }
    ],
    safety: "Dry grass or a turf floor; skip it on a wet gym floor.",
    competitive: "Stop inside the two-step zone is a point; first to eight wins.",
    spacing: "Three cones 10 yd apart; side cone 5 yd off the middle one."
  },
  'lib-ath-006': {
    mistakes: [
      { see: "Players bounce in the holds.", fix: "Slow and still; breathe through it." },
      { see: "Lunge knee shoots past the toes.", fix: "Longer step, knee over the ankle." }
    ],
    spacing: "Arm's length apart."
  },
  'lib-ath-007': {
    mistakes: [
      { see: "Push-ups with the hips sagging.", fix: "Drop to the knees and keep the body straight." },
      { see: "Players race for reps and form falls apart.", fix: "Coach counts only good reps out loud." }
    ],
    safety: "Bodyweight only, no added weight; stop a station when form breaks.",
    competitive: "Coach calls good reps; the group with the most good reps called in a round wins.",
    spacing: "Stations 10 ft apart."
  },
  'lib-ath-008': {
    mistakes: [
      { see: "Players stand tall and reach with their arms.", fix: "Stay low, move the feet." },
      { see: "Boxes overlap and pairs collide.", fix: "One pair per box, boxes 5 yd apart." }
    ],
    safety: "Knee tags only, no shoving; one pair per box.",
    competitive: "Already competitive; winner stays leader and the final two play one last round for the group.",
    spacing: "10 yd box; pairs start 5 ft apart; boxes 5 yd apart."
  },

  // -------------------------------------------------------------------------
  // BASEBALL IQ
  // -------------------------------------------------------------------------
  'lib-iq-001': {
    mistakes: [
      { see: "Only the loud kids answer.", fix: "Point at a position, then at a player; everyone draws one arrow." },
      { see: "Players know their spot but not why.", fix: "Ask where the ball is going before asking where they go." }
    ],
    competitive: "Two teams at the board; the first team with every arrow right on a situation wins the point.",
  },
  'lib-iq-002': {
    mistakes: [
      { see: "Questions are above the age group.", fix: "Pick rules that came up in your own games this month." },
      { see: "Coach explains too long.", fix: "One sentence on why, then the next question." }
    ],
    competitive: "Team quiz; six questions, most right wins, tie goes to the fastest hand.",
  },
  'lib-iq-003': {
    mistakes: [
      { see: "Only the fielder with the ball points.", fix: "Everyone points, including outfielders." },
      { see: "Players point late after watching others.", fix: "Point within one second of freeze or it does not count." }
    ],
    competitive: "Nine matching points is a team point; eight of ten wins the drill.",
  },
  'lib-iq-004': {
    mistakes: [
      { see: "Hitters write nothing or just watch.", fix: "One mark per pitch: fast or slow, high or low, strike or ball." },
      { see: "Plan is a wish, not a plan.", fix: "A plan names a pitch and a location to look for." }
    ],
    competitive: "Hitter whose plan matches what the pitcher actually threw first gets to hit first.",
  },
  'lib-iq-005': {
    mistakes: [
      { see: "Player-coach signals late or quietly.", fix: "Decide when the ball is fielded, signal big and loud." },
      { see: "Runner ignores the signal.", fix: "Runner follows the signal no matter what; the call gets graded, not the runner." }
    ],
    safety: "Helmets on runners; fielders throw to bases, never at runners.",
    competitive: "Clear early call that the coach agrees with is a point; player-coach with the most points leads the next round.",
  },
  'lib-iq-006': {
    mistakes: [
      { see: "Coach answers his own question.", fix: "Wait; silence is fine for ten seconds." },
      { see: "Same two players answer every day.", fix: "Pick a new player to go first each practice." }
    ],
  },

  // -------------------------------------------------------------------------
  // MENTAL SKILLS
  // -------------------------------------------------------------------------
  'lib-men-001': {
    mistakes: [
      { see: "Routine changes every walk-up.", fix: "Partner says same or different; three different in a row means pick a simpler one." },
      { see: "Routine takes too long and slows the game.", fix: "Three parts, under five seconds." }
    ],
    competitive: "Partner scores five walk-ups; five for five same earns the hitter first swings at the next station.",
  },
  'lib-men-002': {
    mistakes: [
      { see: "Player skips the reset and jumps straight into the next rep.", fix: "Coach holds the next ball until the reset is done out loud." },
      { see: "Player gets frustrated at the planned miss.", fix: "Remind him the miss was planned; only the reset is graded." }
    ],
    competitive: "Reset done within five seconds without a reminder is a point; five of five wins.",
  },
  'lib-men-003': {
    mistakes: [
      { see: "Goal is a result, like get a hit.", fix: "Ask what action makes that more likely, and use that." },
      { see: "Nobody checks at the end.", fix: "Put the check in the last three minutes of the plan." }
    ],
    competitive: "Every player who can show one moment he did his goal earns the team a point toward a reward.",
  },
  'lib-men-004': {
    mistakes: [
      { see: "Swap is a lie, like I always hit this guy.", fix: "Short and true: see it, hit it hard." },
      { see: "Session turns personal.", fix: "Coach supplies the thoughts; nobody shares his own unless he wants to." }
    ],
  },
  'lib-men-005': {
    mistakes: [
      { see: "Players giggle and peek.", fix: "Eyes down at the ground is fine; keep it to one minute." },
      { see: "They picture the whole game.", fix: "One rep, three times, slow." }
    ],
  },
  'lib-men-006': {
    mistakes: [
      { see: "Teammates heckle instead of counting.", fix: "Counting only; heckling costs the heckler a turn." },
      { see: "Player rushes to get it over with.", fix: "Routine first, every rep." }
    ],
    safety: "Everyone watching stays 15 ft back and out of the throwing lane.",
    competitive: "Already a challenge; add a team streak of players who make it in a row.",
    spacing: "Team 15 ft behind the player, out of the throwing lane."
  },
  'lib-men-007': {
    mistakes: [
      { see: "Coach shares a joke mistake, not a real one.", fix: "Pick a real one; the kids can tell." },
      { see: "Teammates fix or tease.", fix: "Only question allowed: what did you learn?" }
    ],
  },
  'lib-men-008': {
    mistakes: [
      { see: "Players say I did good.", fix: "Specific beats nice: name the play." },
      { see: "Circle runs long.", fix: "Three minutes; pairs if the roster is big." }
    ],
    competitive: "Fastest circle with every answer specific earns the team word for the break.",
  }
};

/** Drill ids the audit found weak, with a one-line reason each (for the decisions log). Our own assessment. */
export const AUDIT_NOTES: Array<{ id: string; note: string }> = [
  { id: 'lib-hit-006', note: "Step 5 says 'hit to the right field' meaning the correct field; reads as right field. Reword to 'the field the pitch calls for'." },
  { id: 'lib-hit-008', note: "Tag 'hit-and-run' is not in the drill. Drop the tag or add a hit-and-run round." },
  { id: 'lib-hit-011', note: "Success criterion ('ball jumps, hitter looks easy') is not observable. Replace with 'eight of ten swings show the back foot turned and the head still'." },
  { id: 'lib-hit-012', note: "Firm flat tosses from 10 ft to level 3 to 5 hitters puts the coach at risk. Require a full L-screen and move to 15 ft for 13U and older." },
  { id: 'lib-hit-013', note: "Near duplicate of lib-hit-006 (two speeds, random mix, call what you saw). Keep it as the machine-only version with the machine distance stated, or merge." },
  { id: 'lib-thr-006', note: "Setup says 'max for the age group' but no number is given anywhere. Add a conservative cap per age (about 120 ft 10U, 150 ft 12U, 180 ft 14U)." },
  { id: 'lib-thr-009', note: "Listed as a warm-up block but it is moderate-load competitive throwing. Remove 'warmup' from blocks or require lib-thr-001 first." },
  { id: 'lib-cat-006', note: "A volunteer coach can rarely fungo true pop-ups behind the plate. Make hand toss the base version and fungo the harder one." },
  { id: 'lib-cat-007', note: "The pitcher throws 25 counted pitches, which is a bullpen, but throwingLoad is 'light' (for the catcher). Flag the pitcher's load as high so the generator does not stack it with lib-pit-004." },
  { id: 'lib-pit-004', note: "Fifteen minutes cannot fit two or three pitchers each throwing 25 to 30 pitches with one catcher. Make minutes per pitcher or run two pitcher and catcher pairs side by side." },
  { id: 'lib-pit-005', note: "Five batters per pitcher can reach 35 pitches at high load, and nothing stops it being run the same day as a bullpen. Cap at 20 pitches per pitcher and mark it as a bullpen day." },
  { id: 'lib-inf-006', note: "Harder version adds a sliding runner into a middle infielder at 10U with only a parenthetical about sliding. Require feet-first slides to the back of the bag and no runner until lib-br-007 is done." },
  { id: 'lib-inf-007', note: "'Glove in front of the left foot' assumes a right-handed thrower. Say 'glove-side foot' so lefties are not taught backwards." },
  { id: 'lib-inf-010', note: "Harder version bounces real baseballs off a wall at a sharper angle with a faster throw at an unprotected face. UNSAFE for 8U to 14U; keep tennis or soft balls at every level and remove the wall-baseball variant." },
  { id: 'lib-inf-012', note: "Two coaches hitting from home at once means two balls in play on one infield. State that one hits and one times; also 21 outs with error subtraction runs long, start at 15." },
  { id: 'lib-of-005', note: "90 to 120 ft base distance with no ageMin is unrealistic for 8U and 9U arms. Add age scaling (60 ft for 10U and under) or an ageMin of 10U." },
  { id: 'lib-of-007', note: "Step 5 needs someone to toss to the coach for a live swing, but coaches is 1. Note that a player tosses, or drop the step to the harder version." },
  { id: 'lib-br-005', note: "Base version has 10U runners diving back headfirst with no sliding progression required. Say get back standing or feet first, and gate headfirst dives on lib-br-007." },
  { id: 'lib-sit-002', note: "Cue text tells players to 'check the board' but practice has no scoreboard. Change to 'ask the catcher'." },
  { id: 'lib-td-002', note: "No distances given for a drill about whether a relay beats one long throw. Add outfielder 150 ft from the base and relay halfway so the comparison is real." }
];
