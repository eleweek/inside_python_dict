import {singularOrPlural} from './util';

export function commonFormatCheckCollisionLoopEndedPart(idx, fmtCollisionCount) {
    if (fmtCollisionCount > 0) {
        return `After ${fmtCollisionCount} ${singularOrPlural(
            fmtCollisionCount,
            'collision',
            'collisions'
        )}, an empty slot (at <code>${idx}</code>) is found: ${singularOrPlural(
            fmtCollisionCount,
            'the collision is',
            'the collisions are'
        )} successfully resolved`;
    } else {
        return `Slot <code>${idx}</code> is empty: no need to do collision resolution`;
    }
}

export function chapter1_2_FormatCheckCollision(l, idx, fmtCollisionCount) {
    if (l.get(idx) == null) {
        return commonFormatCheckCollisionLoopEndedPart(idx, fmtCollisionCount);
    } else {
        return `Slot <code>${idx}</code> is occupied by <code>${l.get(idx)}</code>: a collision occurred`;
    }
}

export function commonFormatCheckNotFound(l, idx, fmtCollisionCount) {
    const tryN = fmtCollisionCount + 1;
    if (l.get(idx) == null) {
        if (fmtCollisionCount == 0) {
            return `[Try #${tryN}] Slot <code>${idx}</code> is empty, so don't loop`;
        } else {
            return `[Try #${tryN}] Slot <code>${idx}</code> is empty, stop looping`;
        }
    } else {
        return `[Try #${tryN}] Slot <code>${idx}</code> is occupied, so check it`;
    }
}
