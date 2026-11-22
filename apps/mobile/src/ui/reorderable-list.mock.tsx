// Tests only: react-native-reorderable-list's animated list needs native refs Jest doesn't have. This stand-in renders
// a plain FlatList and keeps the props, so a test can call `onReorder` the way a drop would:
// `jest.mock("react-native-reorderable-list", () => require("@/ui/reorderable-list.mock"))`.
import type { FlatListProps } from "react-native";
import { FlatList } from "react-native";

type ReorderableProps<T> = FlatListProps<T> & { onReorder: (event: { from: number; to: number }) => void };

export const lastList: { props: ReorderableProps<unknown> | null } = { props: null };
const record = (props: ReorderableProps<unknown>) => {
	lastList.props = props;
};

function ReorderableList<T>({ onReorder, ...props }: ReorderableProps<T>) {
	record({ ...(props as FlatListProps<unknown>), onReorder });
	return <FlatList {...props} />;
}

export const useReorderableDrag = () => () => undefined;
export const useIsActive = () => false;
export default ReorderableList;
