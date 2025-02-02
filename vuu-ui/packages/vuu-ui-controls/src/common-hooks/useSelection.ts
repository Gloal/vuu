import {
  getElementByDataIndex,
  getElementDataIndex,
  isSelectableElement,
} from "@finos/vuu-utils";
import {
  KeyboardEvent,
  MouseEvent,
  SyntheticEvent,
  useCallback,
  useRef,
} from "react";
import {
  ListHandlers,
  SelectionHookProps,
  SelectionHookResult,
  selectionIsDisallowed,
  SelectionStrategy,
  SingleSelectionStrategy,
} from "./selectionTypes";
import { useControlled } from "./useControlled";

export const CHECKBOX = "checkbox";

export const GROUP_SELECTION_NONE = "none";
export const GROUP_SELECTION_SINGLE = "single";
export const GROUP_SELECTION_CASCADE = "cascade";

const NO_SELECTION_HANDLERS: ListHandlers = {};

export type GroupSelectionMode = "none" | "single" | "cascade";

const defaultSelectionKeys = ["Enter", " "];

export const groupSelectionEnabled = (
  groupSelection: GroupSelectionMode
): boolean => groupSelection && groupSelection !== GROUP_SELECTION_NONE;

export const useSelection = <Selection extends SelectionStrategy = "default">({
  containerRef,
  defaultSelected,
  disableSelection = false,
  // groupSelection = GROUP_SELECTION_NONE,
  highlightedIdx,
  itemQuery,
  // label,
  onSelect,
  onSelectionChange,
  selected: selectedProp,
  selectionStrategy,
  selectionKeys = defaultSelectionKeys,
  tabToSelect,
}: SelectionHookProps<Selection>): SelectionHookResult<Selection> => {
  const isDeselectable = selectionStrategy === "deselectable";
  const isMultipleSelect = selectionStrategy === "multiple";
  const isExtendedSelect = selectionStrategy === "extended";
  const lastActive = useRef(-1);

  const isSelectionEvent = useCallback(
    (evt: KeyboardEvent) => selectionKeys.includes(evt.key),
    [selectionKeys]
  );

  const emptyValue = useCallback((): Selection extends SingleSelectionStrategy
    ? null
    : string[] => {
    type returnType = Selection extends SingleSelectionStrategy
      ? null
      : string[];
    return isMultipleSelect || isExtendedSelect
      ? ([] as unknown as returnType)
      : (null as returnType);
  }, [isMultipleSelect, isExtendedSelect]);

  const [selected, setSelected] = useControlled<
    Selection extends SingleSelectionStrategy ? string | null : string[]
  >({
    controlled: selectedProp,
    default: defaultSelected ?? emptyValue(),
    name: "UseSelection",
    state: "selected",
  });

  const isItemSelected = useCallback(
    (itemId: string) => {
      return Array.isArray(selected)
        ? selected.includes(itemId)
        : selected === itemId;
    },
    [selected]
  );

  const selectDeselectable = useCallback(
    (itemId: string) => (isItemSelected(itemId) ? null : itemId),
    [isItemSelected]
  );
  const selectMultiple = useCallback(
    (itemId: string) => {
      const nextItems = isItemSelected(itemId)
        ? (selected as string[]).filter((i) => i !== itemId)
        : (selected as string[]).concat(itemId);
      // nextItems.sort(byItemIndex);
      nextItems.sort();
      return nextItems;
    },
    [isItemSelected, selected]
  );
  const selectRange = useCallback(
    (idx: number, preserveExistingSelection?: boolean) => {
      const currentSelection = preserveExistingSelection
        ? (selected as string[])
        : ([] as string[]);

      const [lastSelectedItemId] = (selected as string[]).slice(-1);
      const lastSelectedItemIndex = lastSelectedItemId
        ? getElementDataIndex(document.getElementById(lastSelectedItemId))
        : 0;

      const startRegion = Math.min(idx, lastSelectedItemIndex);
      const endRegion = Math.max(idx, lastSelectedItemIndex);

      const container = containerRef.current as HTMLElement;
      const allItems = Array.from(
        container.querySelectorAll(itemQuery)
      ) as HTMLElement[];
      const rangeSelection = allItems
        .slice(startRegion, endRegion + 1)
        .map((el) => el.id);
      // concat the current selection with a new selection and remove duplicates for overlaps
      const nextItems = [...new Set([...currentSelection, ...rangeSelection])];
      // nextItems.sort(byItemIndex);
      nextItems.sort();
      return nextItems;
    },
    [containerRef, itemQuery, selected]
  );

  const selectItemAtIndex = useCallback(
    (
      evt: SyntheticEvent,
      idx: number,
      rangeSelect: boolean,
      preserveExistingSelection?: boolean
    ) => {
      type returnType = Selection extends SingleSelectionStrategy
        ? string | null
        : string[];

      const { current: container } = containerRef;
      const { id } = getElementByDataIndex(container, idx, true);

      let newSelected: returnType;
      if (isMultipleSelect) {
        newSelected = selectMultiple(id) as returnType;
      } else if (isExtendedSelect) {
        if (preserveExistingSelection && !rangeSelect) {
          newSelected = selectMultiple(id) as returnType;
        } else if (rangeSelect) {
          newSelected = selectRange(
            idx,
            preserveExistingSelection
          ) as returnType;
        } else {
          newSelected = [id] as returnType;
        }
      } else if (isDeselectable) {
        newSelected = selectDeselectable(id) as returnType;
      } else {
        newSelected = id as returnType;
      }

      if (newSelected !== selected) {
        setSelected(newSelected);
      }

      // We fire onSelect irrespective of whether selection changes
      onSelect?.(evt, id);

      if (newSelected !== selected) {
        if (onSelectionChange) {
          onSelectionChange(evt, newSelected);
        }
      }
    },
    [
      containerRef,
      isMultipleSelect,
      isExtendedSelect,
      isDeselectable,
      selected,
      onSelect,
      selectMultiple,
      selectRange,
      selectDeselectable,
      setSelected,
      onSelectionChange,
    ]
  );

  const handleKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      const { current: container } = containerRef;
      const element = getElementByDataIndex(container, highlightedIdx);
      if (isSelectableElement(element)) {
        if (isSelectionEvent(evt) || (tabToSelect && evt.key === "Tab")) {
          // We do not inhibit Tab behaviour, if we are selecting on Tab then we apply
          // selection as a side effect of the Tab, not as a replacement for Tabbing.
          if (evt.key !== "Tab") {
            evt.preventDefault();
          }
          selectItemAtIndex(
            evt,
            highlightedIdx,
            false,
            evt.ctrlKey || evt.metaKey
          );
          if (isExtendedSelect) {
            lastActive.current = highlightedIdx;
          }
        }
      }
    },
    [
      highlightedIdx,
      containerRef,
      isSelectionEvent,
      tabToSelect,
      selectItemAtIndex,
      isExtendedSelect,
    ]
  );

  const handleKeyboardNavigation = useCallback(
    (evt: KeyboardEvent, currentIndex: number) => {
      if (isExtendedSelect && evt.shiftKey) {
        const { current: container } = containerRef;
        const element = getElementByDataIndex(container, currentIndex);
        if (isSelectableElement(element)) {
          selectItemAtIndex(evt, currentIndex, true);
        }
      }
    },
    [isExtendedSelect, containerRef, selectItemAtIndex]
  );

  const handleClick = useCallback(
    (evt: MouseEvent) => {
      const { current: container } = containerRef;
      const element = getElementByDataIndex(container, highlightedIdx);
      if (!disableSelection && isSelectableElement(element)) {
        // if (!isCollapsibleItem(item)) {
        evt.preventDefault();
        evt.stopPropagation();
        selectItemAtIndex(
          evt,
          highlightedIdx,
          evt.shiftKey,
          evt.ctrlKey || evt.metaKey
        );
        if (isExtendedSelect) {
          lastActive.current = highlightedIdx;
        }
        // }
      }
    },
    [
      containerRef,
      highlightedIdx,
      disableSelection,
      selectItemAtIndex,
      isExtendedSelect,
    ]
  );

  const listHandlers = selectionIsDisallowed(selectionStrategy)
    ? NO_SELECTION_HANDLERS
    : {
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        onKeyboardNavigation: handleKeyboardNavigation,
      };

  return {
    listHandlers,
    selected,
    setSelected,
  };
};
