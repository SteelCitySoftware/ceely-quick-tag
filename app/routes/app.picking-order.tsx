import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, Link } from "@remix-run/react";
import {
  Page,
  Form,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
} from "@shopify/polaris";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function DraggableLocation({
  id,
  isSelected,
  toggleSelection,
}: {
  id: string;
  isSelected: boolean;
  toggleSelection: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: "10px",
    border: isSelected ? "2px solid blue" : "1px solid #ccc",
    marginBottom: "5px",
    backgroundColor: "white",
    cursor: "grab",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => toggleSelection(id)}
    >
      {id}
    </div>
  );
}

export default function LocationPicker() {
  const [locations, setLocations] = useState<{
    Main_Locations: string[];
    Overstock_Locations: string[];
  } | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setLocations(JSON.parse(e.target.result as string));
        }
      };
      reader.readAsText(file);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (locations && over) {
      const activeIndex = locations.Main_Locations.indexOf(active.id);
      const overIndex = locations.Main_Locations.indexOf(over.id);
      const newLocations = arrayMove(
        locations.Main_Locations,
        activeIndex,
        overIndex,
      );
      setLocations((prev) =>
        prev ? { ...prev, Main_Locations: newLocations } : prev,
      );
    }
  };

  const saveNewOrder = () => {
    if (!locations) return;
    const newPickingOrder = {
      Location_Picking_Order: locations.Main_Locations,
    };
    const fileData = JSON.stringify(newPickingOrder, null, 2);
    const blob = new Blob([fileData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "location_picking_order.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Page title="Reorder Locations">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Text variant="headingMd">Upload JSON File</Text>
            <input
              type="file"
              accept="application/json"
              onChange={handleFileUpload}
              className="mb-4"
            />
            {locations && (
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={locations.Main_Locations}
                  strategy={verticalListSortingStrategy}
                >
                  <BlockStack spacing="tight">
                    {locations.Main_Locations.map((location) => (
                      <DraggableLocation
                        key={location}
                        id={location}
                        isSelected={selectedItems.includes(location)}
                        toggleSelection={toggleSelection}
                      />
                    ))}
                  </BlockStack>
                </SortableContext>
              </DndContext>
            )}
            {locations && (
              <Button onClick={saveNewOrder}>Save New Order</Button>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
