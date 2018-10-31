import {singularOrPlural} from './util';

export function commonFormatCheckCollision(l, idx, fmtCollisionCount) {
    if (l.get(idx) == null) {
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
