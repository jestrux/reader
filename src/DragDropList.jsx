import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

const reorder = (list, startIndex, endIndex) => {
	const result = Array.from(list);
	const [removed] = result.splice(startIndex, 1);
	result.splice(endIndex, 0, removed);

	return result;
};

const getItemStyle = (isDragging, draggableStyle) => ({
	userSelect: "none",
	...draggableStyle,
});

const DragDropList = ({
	items,
	idKey = "id",
	onChange,
	children,
	className,
}) => {
	const [entries, setEntries] = useState(items);

	const onDragEnd = (result) => {
		if (!result.destination) return;

		var newValues = reorder(
			entries,
			result.source.index,
			result.destination.index
		);
		setEntries(newValues);
		onChange(newValues);
	};

	return (
		<DragDropContext onDragEnd={onDragEnd}>
			<Droppable droppableId="droppable">
				{(provided) => (
					<div
						className={className}
						{...provided.droppableProps}
						ref={provided.innerRef}
					>
						{entries.map((item, index) => (
							<Draggable
								key={item[idKey]}
								draggableId={item[idKey]}
								index={index}
							>
								{(provided, snapshot) => (
									<div
										ref={provided.innerRef}
										{...provided.draggableProps}
										{...provided.dragHandleProps}
										style={getItemStyle(
											snapshot.isDragging,
											provided.draggableProps.style
										)}
									>
										{children({ item })}
									</div>
								)}
							</Draggable>
						))}
						{provided.placeholder}
					</div>
				)}
			</Droppable>
		</DragDropContext>
	);
};

export default DragDropList;
