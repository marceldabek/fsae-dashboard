import React, { useState } from 'react';
import {
  GanttCreateMarkerTrigger,
  GanttFeatureItem,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttHeader,
  GanttMarker,
  GanttProvider,
  GanttTimeline,
  GanttToday,
} from '@/components/ui/kibo-ui/GanttDropIn';

const initialFeatures = [
  {
    id: '1',
    name: 'Design Phase',
    startAt: new Date(2025, 7, 1),
    endAt: new Date(2025, 7, 10),
    status: { id: 'todo', name: 'To Do', color: '#f59e42' },
  },
  {
    id: '2',
    name: 'Development',
    startAt: new Date(2025, 7, 11),
    endAt: new Date(2025, 7, 20),
    status: { id: 'inprogress', name: 'In Progress', color: '#3b82f6' },
  },
  {
    id: '3',
    name: 'Testing',
    startAt: new Date(2025, 7, 21),
    endAt: new Date(2025, 7, 25),
    status: { id: 'done', name: 'Done', color: '#10b981' },
  },
];

const initialMarkers = [
  { id: 'm1', date: new Date(2025, 7, 5), label: 'Kickoff' },
  { id: 'm2', date: new Date(2025, 7, 15), label: 'Review' },
];

export default function GanttTimelineExample() {
  const [features, setFeatures] = useState(initialFeatures);
  const [markers, setMarkers] = useState(initialMarkers);

  const handleAddFeature = (date: Date) => {
    const newFeature = {
      id: String(features.length + 1),
      name: `New Feature ${features.length + 1}`,
      startAt: date,
      endAt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 3),
      status: { id: 'todo', name: 'To Do', color: '#f59e42' },
    };
    setFeatures([...features, newFeature]);
  };

  const handleCreateMarker = (date: Date) => {
    const newMarker = {
      id: `m${markers.length + 1}`,
      date,
      label: `Marker ${markers.length + 1}`,
    };
    setMarkers([...markers, newMarker]);
  };

  return (
    <GanttProvider range="monthly" zoom={100} onAddItem={handleAddFeature}>
      <div style={{ display: 'flex', flexDirection: 'column', height: 500 }}>
        <GanttHeader />
        <div style={{ position: 'relative', flex: 1 }}>
          <GanttTimeline>
            <GanttFeatureList>
              <GanttFeatureListGroup>
                {features.map((feature) => (
                  <GanttFeatureItem key={feature.id} {...feature} />
                ))}
              </GanttFeatureListGroup>
            </GanttFeatureList>
            {markers.map((marker) => (
              <GanttMarker key={marker.id} {...marker} />
            ))}
            <GanttToday />
            <GanttCreateMarkerTrigger onCreateMarker={handleCreateMarker} />
          </GanttTimeline>
        </div>
      </div>
    </GanttProvider>
  );
}
