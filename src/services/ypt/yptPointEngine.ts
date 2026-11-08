import {
  YptChallenge,
  YptCustomRule,
  YptDailyDaySnapshot,
} from "../../types/yptTypes.js";
import { areYptHandlesMatching } from "../../utils/yptUtils.js";

export interface AppliedRuleItem {
  ruleId: string;
  ruleName: string;
  emoji: string;
  points: number;
  type: "bonus" | "penalty" | "base" | "milestone" | "exempt";
}

/**
 * Evaluates whether a custom point rule condition matches based on detected emojis,
 * completed native YPT challenges, study hours, and morning snap status.
 */
export function evaluatePointRule(
  rule: YptCustomRule | any,
  detectedEmojis: string[] = [],
  hoursStudied: number = 0,
  hasSnap: boolean = false,
  completedNativeChallengeIds: number[] = []
): boolean {
  if (!rule || !rule.name) return false;

  const targetHours = Number(rule.targetHours || rule.hours) || 0;
  const targetMins = Number(rule.targetMinutes || rule.minutes) || 0;
  const effectiveTargetHours = targetHours + targetMins / 60;

  const hasNativeId = Boolean(rule.nativeChallengeId || rule.challengeId);
  const targetCid = Number(rule.nativeChallengeId || rule.challengeId);

  const isNativeChallengeCompleted = Boolean(
    hasNativeId &&
      !isNaN(targetCid) &&
      (completedNativeChallengeIds.includes(targetCid) ||
        completedNativeChallengeIds.map(String).includes(String(targetCid)))
  );

  const ruleEmoji = rule.emoji ? String(rule.emoji).trim() : "";
  const nameLower = String(rule.name).toLowerCase();

  const missionMatched = hasNativeId
    ? isNativeChallengeCompleted
    : Boolean(
        ruleEmoji &&
          detectedEmojis.some((e) => e.includes(ruleEmoji) || ruleEmoji.includes(e))
      ) ||
      Boolean(
        (hasSnap || detectedEmojis.includes("☀️")) &&
          (nameLower.includes("snap") || ruleEmoji === "☀️")
      );

  if (
    rule.type === "milestone" ||
    rule.criteriaType === "study_hours" ||
    rule.category === "study_hours"
  ) {
    return effectiveTargetHours > 0
      ? hoursStudied >= effectiveTargetHours
      : hoursStudied >= (rule.minHoursNeeded ?? 0);
  }

  if (
    rule.criteriaType === "native_challenge" ||
    rule.category === "native_challenge"
  ) {
    return isNativeChallengeCompleted;
  }

  const minHours = rule.minHoursNeeded ?? 0;
  const hoursMatched = hoursStudied >= minHours;
  const condition = rule.conditionType || "emoji_only";

  switch (condition) {
    case "hours_only":
      return hoursMatched;
    case "both":
      return missionMatched && hoursMatched;
    case "either":
      return missionMatched || hoursMatched;
    case "emoji_only":
    default:
      return missionMatched;
  }
}

/**
 * Canonical cross-environment point calculator used across Frontend UI, Snapshot Service, and Backend Cron.
 * @param applyPenalty Set to false during active open live day to avoid premature penalties while studying.
 * @param maxContinuousMs Maximum continuous study session duration in milliseconds (dl.mm).
 */
export function calculatePointsFromRules(
  hoursStudied: number,
  rules: YptChallenge["rules"] | any = {},
  detectedEmojis: string[] = [],
  hasSnap: boolean = false,
  completedNativeChallengeIds: number[] = [],
  applyPenalty: boolean = true,
  maxContinuousMs: number = 0
): {
  totalPoints: number;
  baseStudyPoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  netPoints: number;
  appliedRules: AppliedRuleItem[];
} {
  const safeHours =
    typeof hoursStudied === "number" && !isNaN(hoursStudied) && hoursStudied > 0
      ? hoursStudied
      : 0;

  const intervalVal = rules?.studyIntervalValue ?? 1;
  const intervalUnit = rules?.studyIntervalUnit ?? "hours";
  const intervalHours =
    intervalUnit === "minutes" ? intervalVal / 60 : intervalVal || 1;
  const ptsPerInterval =
    rules?.pointsPerInterval ?? rules?.pointsPerStudyHour ?? 1;

  const baseStudyPoints =
    Math.floor(safeHours / (intervalHours || 1)) * ptsPerInterval;

  const penaltyThresholdVal =
    rules?.penaltyThresholdValue ?? rules?.noStudyPenaltyThresholdHours ?? 3;
  const penaltyThresholdUnit = rules?.penaltyThresholdUnit ?? "hours";
  const penaltyThresholdHours =
    penaltyThresholdUnit === "minutes"
      ? penaltyThresholdVal / 60
      : penaltyThresholdVal || 3;

  const isPenalized = applyPenalty && safeHours < penaltyThresholdHours;
  const penaltyDeduction = isPenalized ? rules?.penaltyPoints || 0 : 0;

  const appliedRules: AppliedRuleItem[] = [];
  let bonusPoints = 0;
  let customPenaltyDeduction = 0;

  if (Array.isArray(rules?.customRules)) {
    for (const cr of rules.customRules) {
      if (
        evaluatePointRule(
          cr,
          detectedEmojis,
          safeHours,
          hasSnap,
          completedNativeChallengeIds
        )
      ) {
        const p = Number(cr.points) || 0;
        const isBonus = cr.type === "bonus" || cr.type === "milestone";
        const awardedPts = isBonus ? p : -p;
        const isTeamAll = cr.scope === "team_all";
        const effectivePts = isTeamAll ? 0 : awardedPts;

        if (effectivePts < 0 && !applyPenalty) {
          continue;
        }

        if (effectivePts > 0) {
          bonusPoints += effectivePts;
        } else if (effectivePts < 0) {
          customPenaltyDeduction += Math.abs(effectivePts);
        }

        appliedRules.push({
          ruleId: cr.id || "",
          ruleName: cr.name || (isBonus ? "Bonus Rule" : "Penalty Rule"),
          emoji: cr.emoji || (isBonus ? "☀️" : "📱"),
          points: effectivePts,
          type:
            cr.type === "milestone"
              ? "milestone"
              : isBonus
              ? "bonus"
              : "penalty",
        });
      }
    }
  }

  if (isPenalized && penaltyDeduction > 0) {
    appliedRules.push({
      ruleId: "no_study_penalty",
      ruleName: "No Study Penalty",
      emoji: "⚠️",
      points: -penaltyDeduction,
      type: "penalty",
    });
  }

  let maxContinuousPenaltyDeduction = 0;
  const maxContThreshold = rules?.maxContinuousHoursThreshold;
  if (
    typeof maxContThreshold === "number" &&
    maxContThreshold > 0 &&
    maxContinuousMs > 0
  ) {
    const maxContHours = maxContinuousMs / 3600000;
    if (maxContHours > maxContThreshold) {
      const penaltyType = rules?.maxContinuousPenaltyType || "variable";

      if (penaltyType === "fixed") {
        const fixedDeduction =
          typeof rules?.maxContinuousFixedPenalty === "number"
            ? rules.maxContinuousFixedPenalty
            : 0;
        if (fixedDeduction > 0) {
          maxContinuousPenaltyDeduction = fixedDeduction;
          appliedRules.push({
            ruleId: "max_continuous_fake_session_penalty",
            ruleName: `Fake Session Penalty (>${maxContThreshold}hrs - Flat Deduction)`,
            emoji: "🚨",
            points: -fixedDeduction,
            type: "penalty",
          });
        }
      } else {
        const mode = rules?.maxContinuousPenaltyMode || "excess";
        const targetHours =
          mode === "whole" ? maxContHours : maxContHours - maxContThreshold;

        if (targetHours > 0) {
          const multiplier = rules?.maxContinuousPenaltyMultiplier ?? 1;
          const baseTargetPoints =
            Math.floor(targetHours / (intervalHours || 1)) * ptsPerInterval;
          const calculatedPenalty = Math.max(0, baseTargetPoints * multiplier);

          if (calculatedPenalty > 0) {
            maxContinuousPenaltyDeduction = calculatedPenalty;
            appliedRules.push({
              ruleId: "max_continuous_fake_session_penalty",
              ruleName: `Fake Session Penalty (>${maxContThreshold}hrs)`,
              emoji: "🚨",
              points: -calculatedPenalty,
              type: "penalty",
            });
          }
        }
      }
    }
  }

  const penaltyPoints =
    penaltyDeduction + customPenaltyDeduction + maxContinuousPenaltyDeduction;
  const netPoints = baseStudyPoints + bonusPoints - penaltyPoints;

  return {
    totalPoints: netPoints,
    baseStudyPoints,
    bonusPoints,
    penaltyPoints,
    netPoints,
    appliedRules,
  };
}

export function calculateMemberPointsForDate(
  hoursStudied: number,
  rules: YptChallenge["rules"],
  appliedRules?: Array<{ points?: number }>,
  applyPenalty: boolean = true
): number {
  const intervalVal = rules?.studyIntervalValue ?? 1;
  const intervalUnit = rules?.studyIntervalUnit ?? "hours";
  const intervalHours =
    intervalUnit === "minutes" ? intervalVal / 60 : intervalVal || 1;
  const ptsPerInterval =
    rules?.pointsPerInterval ?? rules?.pointsPerStudyHour ?? 1;

  const baseStudyPoints =
    Math.floor(hoursStudied / (intervalHours || 1)) * ptsPerInterval;

  const penaltyThresholdVal =
    rules?.penaltyThresholdValue ?? rules?.noStudyPenaltyThresholdHours ?? 3;
  const penaltyThresholdUnit = rules?.penaltyThresholdUnit ?? "hours";
  const penaltyThresholdHours =
    penaltyThresholdUnit === "minutes"
      ? penaltyThresholdVal / 60
      : penaltyThresholdVal || 3;

  const isPenalized = applyPenalty && hoursStudied < penaltyThresholdHours;
  const penaltyDeduction = isPenalized ? rules?.penaltyPoints || 0 : 0;

  const rulePointsSum = (appliedRules || []).reduce((sum, r) => {
    const pts = r.points || 0;
    if (pts < 0 && !applyPenalty) return sum;
    return sum + pts;
  }, 0);

  return baseStudyPoints - penaltyDeduction + rulePointsSum;
}

/**
 * Evaluates team-wide (team_all) custom rules directly on a daily snapshot's memberSnapshots and memberRecords.
 * Awards bonus/penalty points ONLY if 100% of registered team members fulfilled the rule on that date.
 */
export function applyTeamWideRulesToSnapshot(
  challenge: YptChallenge,
  memberSnapshots: YptDailyDaySnapshot["memberSnapshots"],
  memberRecords: NonNullable<YptDailyDaySnapshot["memberRecords"]>,
  applyPenalty: boolean
): void {
  if (
    !challenge ||
    (challenge.mode || "team") === "individual" ||
    !challenge.rules ||
    !Array.isArray(challenge.rules.customRules)
  ) {
    return;
  }

  const teamWideRules = challenge.rules.customRules.filter(
    (r) => r.scope === "team_all"
  );
  if (teamWideRules.length === 0) return;

  for (const team of challenge.teams || []) {
    const teamMemberHandles = team.memberUids || [];
    if (teamMemberHandles.length === 0) continue;

    for (const rule of teamWideRules) {
      const pointsVal = Math.abs(Number(rule.points) || 0);
      const awardedPoints = rule.type === "bonus" ? pointsVal : -pointsVal;
      if (awardedPoints < 0 && !applyPenalty) continue;

      const matchedMembers = teamMemberHandles.map((handleOrUid) => {
        const cleanKey = handleOrUid.replace(/^@/, "").trim().toLowerCase();
        const snapEntry =
          memberSnapshots[cleanKey] ||
          Object.values(memberSnapshots).find((ms) =>
            areYptHandlesMatching(
              ms.handle,
              handleOrUid,
              ms.rawYptUd ? String(ms.rawYptUd) : undefined
            )
          );
        const recEntry = memberRecords.find((mr) =>
          areYptHandlesMatching(mr.yptHandle, handleOrUid, mr.userId)
        );
        return { handleOrUid, cleanKey, snapEntry, recEntry };
      });

      const allMetRule = matchedMembers.every(({ snapEntry, recEntry }) => {
        if (!snapEntry && !recEntry) return false;
        const hours = snapEntry?.hoursStudied ?? recEntry?.hoursStudied ?? 0;
        const completedIds =
          snapEntry?.completedNativeChallengeIds ??
          recEntry?.completedChallengeIds ??
          [];
        const rulesList =
          snapEntry?.appliedRuleBreakdown ?? recEntry?.appliedRules ?? [];

        const hasExplicitRule = rulesList.some(
          (r: any) =>
            (rule.id && r.ruleId === rule.id) ||
            (r.ruleName &&
              r.ruleName.toLowerCase() === rule.name.toLowerCase()) ||
            (rule.emoji && r.emoji === rule.emoji)
        );
        if (hasExplicitRule) return true;

        const emojis = rulesList
          .map((r: any) => r.emoji)
          .filter((e: any): e is string => Boolean(e));
        return evaluatePointRule(rule, emojis, hours, false, completedIds);
      });

      for (const { snapEntry, recEntry } of matchedMembers) {
        if (snapEntry) {
          snapEntry.appliedRuleBreakdown = snapEntry.appliedRuleBreakdown || [];
          const idx = snapEntry.appliedRuleBreakdown.findIndex(
            (r) =>
              (rule.id && r.ruleId === rule.id) ||
              r.ruleName.toLowerCase() === rule.name.toLowerCase()
          );

          if (allMetRule) {
            if (idx >= 0) {
              const prevPts = snapEntry.appliedRuleBreakdown[idx].points || 0;
              const delta = awardedPoints - prevPts;
              snapEntry.appliedRuleBreakdown[idx].points = awardedPoints;
              snapEntry.netPoints += delta;
              if (awardedPoints > 0) snapEntry.bonusPoints += delta;
              else snapEntry.penaltyPoints += Math.abs(delta);
            } else {
              snapEntry.appliedRuleBreakdown.push({
                ruleId: rule.id || "team_rule",
                ruleName: rule.name,
                emoji: rule.emoji || (rule.type === "bonus" ? "☀️" : "📱"),
                points: awardedPoints,
                type: rule.type === "bonus" ? "bonus" : "penalty",
              });
              snapEntry.netPoints += awardedPoints;
              if (awardedPoints > 0) snapEntry.bonusPoints += awardedPoints;
              else snapEntry.penaltyPoints += Math.abs(awardedPoints);
            }
          } else if (idx >= 0) {
            const prevPts = snapEntry.appliedRuleBreakdown[idx].points || 0;
            if (prevPts !== 0) {
              snapEntry.netPoints -= prevPts;
              if (prevPts > 0)
                snapEntry.bonusPoints = Math.max(0, snapEntry.bonusPoints - prevPts);
              else
                snapEntry.penaltyPoints = Math.max(
                  0,
                  snapEntry.penaltyPoints - Math.abs(prevPts)
                );
              snapEntry.appliedRuleBreakdown[idx].points = 0;
            }
          }
        }

        if (recEntry) {
          recEntry.appliedRules = recEntry.appliedRules || [];
          const idx = recEntry.appliedRules.findIndex(
            (r) =>
              (rule.id && r.ruleId === rule.id) ||
              r.ruleName.toLowerCase() === rule.name.toLowerCase()
          );

          if (allMetRule) {
            if (idx >= 0) {
              const prevPts = recEntry.appliedRules[idx].points || 0;
              const delta = awardedPoints - prevPts;
              recEntry.appliedRules[idx].points = awardedPoints;
              recEntry.netPoints += delta;
              if (awardedPoints > 0) recEntry.bonusPoints += delta;
              else recEntry.penaltyPoints += Math.abs(delta);
            } else {
              recEntry.appliedRules.push({
                ruleId: rule.id || "team_rule",
                ruleName: rule.name,
                emoji: rule.emoji || (rule.type === "bonus" ? "☀️" : "📱"),
                points: awardedPoints,
              });
              recEntry.netPoints += awardedPoints;
              if (awardedPoints > 0) recEntry.bonusPoints += awardedPoints;
              else recEntry.penaltyPoints += Math.abs(awardedPoints);
            }
          } else if (idx >= 0) {
            const prevPts = recEntry.appliedRules[idx].points || 0;
            if (prevPts !== 0) {
              recEntry.netPoints -= prevPts;
              if (prevPts > 0)
                recEntry.bonusPoints = Math.max(0, recEntry.bonusPoints - prevPts);
              else
                recEntry.penaltyPoints = Math.max(
                  0,
                  recEntry.penaltyPoints - Math.abs(prevPts)
                );
              recEntry.appliedRules[idx].points = 0;
            }
          }
        }
      }
    }
  }
}
