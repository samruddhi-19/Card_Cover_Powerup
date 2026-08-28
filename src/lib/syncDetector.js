import { labelItems, memberItems, dueItem } from "./cardItems.js";
import { renderCover } from "./coverRender.js";
import {
  setCardCover,
  uploadCoverAttachment,
  pruneGeneratedCovers,
} from "./trelloApi.js";
import { coverFileName } from "./covers.js";

export const COVER_META_KEY = "coverMeta";

/**
 * Saves cover configuration and a snapshot of current card state.
 */
export async function saveCoverMeta(t, data) {
  try {
    const prev = (await getCoverMeta(t)) || {};
    const meta = {
      ...prev,
      ...data,
      appliedAt: Date.now(),
    };
    await t.set("card", "shared", COVER_META_KEY, meta);
    return meta;
  } catch (err) {
    console.warn("Failed to save cover metadata", err);
    return null;
  }
}

/**
 * Retrieves saved cover metadata from card storage.
 */
export async function getCoverMeta(t) {
  try {
    return await t.get("card", "shared", COVER_META_KEY);
  } catch {
    return null;
  }
}

/**
 * Detects if the card's due date, labels, or members have changed compared
 * to the snapshot taken when the cover was created.
 */
export function detectCoverChanges(card, coverMeta) {
  if (!card || !coverMeta || !coverMeta.cardSnapshot) {
    return { hasChanges: false, changes: [], summary: "" };
  }

  const snap = coverMeta.cardSnapshot;
  const changes = [];
  const placedBadges = coverMeta.badges || [];
  const hasDueBadge = placedBadges.some((b) => b.kind === "due");
  const hasLabelBadges = placedBadges.some((b) => b.kind === "label");
  const hasMemberBadges = placedBadges.some((b) => b.kind === "member");

  // 1. Due date changes
  const snapDue = snap.due ? new Date(snap.due).toISOString() : null;
  const currentDue = card.due ? new Date(card.due).toISOString() : null;
  const snapComplete = Boolean(snap.dueComplete);
  const currentComplete = Boolean(card.dueComplete);

  if (snapDue !== currentDue || snapComplete !== currentComplete) {
    if (hasDueBadge || snapDue || currentDue) {
      let detail = "Due date updated";
      if (!currentDue && snapDue) {
        detail = "Due date was removed";
      } else if (currentDue && !snapDue) {
        detail = `Due date added: ${formatShortDate(card.due)}`;
      } else if (currentDue !== snapDue) {
        detail = `Changed to ${formatShortDate(card.due)}`;
      } else if (snapComplete !== currentComplete) {
        detail = currentComplete ? "Marked complete" : "Marked incomplete";
      }
      changes.push({
        type: "due",
        title: "Due date",
        detail,
        isPlaced: hasDueBadge,
      });
    }
  }

  // 2. Labels changes
  const snapLabels = snap.labels || [];
  const currentLabels = card.labels || [];
  const snapLabelMap = new Map(snapLabels.map((l) => [l.id, l]));
  const currentLabelMap = new Map(currentLabels.map((l) => [l.id, l]));

  let labelsModified = false;
  let labelDetail = "";

  if (snapLabels.length !== currentLabels.length) {
    labelsModified = true;
    const diff = Math.abs(currentLabels.length - snapLabels.length);
    labelDetail =
      currentLabels.length > snapLabels.length
        ? `${diff} new label${diff > 1 ? "s" : ""} added`
        : `${diff} label${diff > 1 ? "s" : ""} removed`;
  } else {
    for (const [id, snapL] of snapLabelMap.entries()) {
      const curL = currentLabelMap.get(id);
      if (!curL || curL.name !== snapL.name || curL.color !== snapL.color) {
        labelsModified = true;
        labelDetail = "Label names or colours changed";
        break;
      }
    }
  }

  if (labelsModified) {
    changes.push({
      type: "labels",
      title: "Labels",
      detail: labelDetail || "Labels updated on this card",
      isPlaced: hasLabelBadges,
    });
  }

  // 3. Members / People changes
  const snapMembers = snap.members || [];
  const currentMembers = card.members || [];
  const snapMemberIds = new Set(snapMembers.map((m) => m.id));
  const currentMemberIds = new Set(currentMembers.map((m) => m.id));

  let membersModified = false;
  let memberDetail = "";

  if (snapMembers.length !== currentMembers.length) {
    membersModified = true;
    const diff = Math.abs(currentMembers.length - snapMembers.length);
    memberDetail =
      currentMembers.length > snapMembers.length
        ? `${diff} member${diff > 1 ? "s" : ""} added`
        : `${diff} member${diff > 1 ? "s" : ""} removed`;
  } else {
    for (const id of snapMemberIds) {
      if (!currentMemberIds.has(id)) {
        membersModified = true;
        memberDetail = "Assigned members changed";
        break;
      }
    }
  }

  if (membersModified) {
    changes.push({
      type: "members",
      title: "People",
      detail: memberDetail || "Assigned people updated on this card",
      isPlaced: hasMemberBadges,
    });
  }

  // Build summary message
  const titles = changes.map((c) => c.title.toLowerCase());
  let summary = "";
  if (titles.length === 1) {
    summary = `${changes[0].title} changed on this card`;
  } else if (titles.length === 2) {
    summary = `${changes[0].title} and ${titles[1]} changed on this card`;
  } else if (titles.length > 2) {
    summary = `${titles.slice(0, -1).join(", ")}, and ${titles.at(-1)} changed on this card`;
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    summary,
  };
}

/**
 * Updates badge values with current card data while strictly preserving
 * their existing placement (x, y) coordinates.
 */
export function syncBadgesWithCard(badges, currentCard) {
  if (!Array.isArray(badges) || badges.length === 0) return [];
  if (!currentCard) return badges;

  const currentLabelItems = labelItems(currentCard.labels || []);
  const currentMemberItems = memberItems(currentCard.members || []);
  const currentDueItem = dueItem(currentCard.due, currentCard.dueComplete);

  const synced = [];

  for (const badge of badges) {
    if (badge.kind === "due") {
      if (currentDueItem) {
        synced.push({
          ...currentDueItem,
          x: badge.x,
          y: badge.y,
        });
      }
    } else if (badge.kind === "label") {
      const match = currentLabelItems.find(
        (l) => l.id === badge.id || l.id.replace("label-", "") === badge.id.replace("label-", "")
      );
      if (match) {
        synced.push({
          ...match,
          x: badge.x,
          y: badge.y,
        });
      }
    } else if (badge.kind === "member") {
      const match = currentMemberItems.find(
        (m) => m.id === badge.id || m.id.replace("member-", "") === badge.id.replace("member-", "")
      );
      if (match) {
        synced.push({
          ...match,
          x: badge.x,
          y: badge.y,
        });
      }
    }
  }

  return synced;
}

/**
 * Re-renders and updates the card cover in the background to match
 * the latest card attributes.
 */
export async function quickSyncCover(t, cardId, coverMeta, currentCard) {
  if (!coverMeta || !coverMeta.selection) {
    throw new Error("No cover metadata found to sync.");
  }

  const updatedBadges = syncBadgesWithCard(coverMeta.badges, currentCard);
  const blob = await renderCover(
    coverMeta.selection,
    coverMeta.text,
    updatedBadges,
    t
  );

  const fileName = coverFileName(coverMeta.selection);
  const attachment = await uploadCoverAttachment(t, cardId, blob, fileName);

  if (coverMeta.size === "full" || (coverMeta.brightness && coverMeta.brightness !== "dark")) {
    await setCardCover(t, cardId, {
      idAttachment: attachment.id,
      size: coverMeta.size || "normal",
      brightness: coverMeta.brightness || "dark",
    }).catch(() => {});
  }

  pruneGeneratedCovers(t, cardId, attachment.id).catch(() => {});

  const newMeta = {
    ...coverMeta,
    attachmentId: attachment.id,
    badges: updatedBadges,
    cardSnapshot: {
      due: currentCard.due || null,
      dueComplete: Boolean(currentCard.dueComplete),
      labels: (currentCard.labels || []).map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
      })),
      members: (currentCard.members || []).map((m) => ({
        id: m.id,
        fullName: m.fullName,
        username: m.username,
        initials: m.initials,
      })),
    },
  };

  await saveCoverMeta(t, newMeta);
  return newMeta;
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
