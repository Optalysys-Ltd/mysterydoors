import { useCallback, useMemo, useState } from "react";

export type DoorId = number; // 1..25

export interface UseMysteryDoorsSelectionOptions {
    maxSelected?: number; // defaults to 5
    initial?: DoorId[];
    onChange?: (selected: DoorId[]) => void;
}

export function useMysteryDoorsSelection(
    opts: UseMysteryDoorsSelectionOptions = {}
) {
    const { maxSelected = 5, initial = [], onChange } = opts;

    const [selectedSet, setSelectedSet] = useState<Set<DoorId>>(
        () => new Set(initial)
    );

    const emit = useCallback(
        (next: Set<DoorId>) => {
            setSelectedSet(new Set(next));
            onChange?.(Array.from(next).sort((a, b) => a - b));
        },
        [onChange]
    );

    const toggleDoor = useCallback(
        (id: DoorId) => {
            const next = new Set(selectedSet);
            if (next.has(id)) {
                next.delete(id);
            } else {
                if (next.size >= maxSelected) {
                    // optional: remove the oldest selected (FIFO)
                    const oldest = Array.from(next)[0];
                    next.delete(oldest);
                }
                next.add(id);
            }
            emit(next);
        },
        [selectedSet, maxSelected, emit]
    );

    const clearSelection = useCallback(() => emit(new Set()), [emit]);

    const isSelected = useCallback((id: DoorId) => selectedSet.has(id), [selectedSet]);

    const selected = useMemo(
        () => Array.from(selectedSet).sort((a, b) => a - b),
        [selectedSet]
    );

    return {
        selected,
        isSelected,
        toggleDoor,
        clearSelection,
        count: selectedSet.size,
        maxSelected,
    };
}
