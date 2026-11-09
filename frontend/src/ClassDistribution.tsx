import { useState } from 'react';
import { Info, Sparkle } from '@phosphor-icons/react';
import { format } from './api';
import { Panel } from './UI';

export interface ClassItem {
  id: string;
  name: string;
  count: number;
  studyCount: number;
  holdoutCount: number;
  percentage: number;
  clusterId: number;
  clusterName: string;
  purity: string;
  color: string;
  description: string;
  visualFeatures: string;
}

export const EUROSAT_CLASSES: ClassItem[] = [
  {
    id: 'forest',
    name: 'Forest',
    count: 3000,
    studyCount: 2400,
    holdoutCount: 600,
    percentage: 11.1,
    clusterId: 2,
    clusterName: 'Group 03 · Forest',
    purity: '74.4% in Group 03',
    color: 'var(--color-cluster-2)',
    description: 'Deciduous, evergreen, and mixed forest canopies across Europe.',
    visualFeatures: 'Higher green saturation (bin 04) and high LBP texture depth.',
  },
  {
    id: 'sea_lake',
    name: 'Sea & Lake',
    count: 3000,
    studyCount: 2400,
    holdoutCount: 600,
    percentage: 11.1,
    clusterId: 6,
    clusterName: 'Group 07 · Deep Water & Group 01 · Wetlands',
    purity: '99.8% in Group 07',
    color: 'var(--color-cluster-6)',
    description: 'Open sea, coastal waters, deep reservoirs, and natural inland lakes.',
    visualFeatures: 'Dominant blue reflectance, uniform tone, minimal texture contrast.',
  },
  {
    id: 'residential',
    name: 'Residential Buildings',
    count: 3000,
    studyCount: 2400,
    holdoutCount: 600,
    percentage: 11.1,
    clusterId: 9,
    clusterName: 'Group 10 · Residential & Built-Up',
    purity: '54.5% in Group 10',
    color: 'var(--color-cluster-9)',
    description: 'Suburban housing, single-family houses, streets, and residential grids.',
    visualFeatures: 'High-frequency edge structures, varied roof color bins, street lines.',
  },
  {
    id: 'annual_crop',
    name: 'Annual Crops',
    count: 3000,
    studyCount: 2400,
    holdoutCount: 600,
    percentage: 11.1,
    clusterId: 4,
    clusterName: 'Group 05 · Annual Crops',
    purity: '53.3% in Group 05',
    color: 'var(--color-cluster-4)',
    description: 'Regularly cultivated seasonal arable land, grains, and tilled soils.',
    visualFeatures: 'Rectangular plot boundaries, seasonal soil hues, high value variance.',
  },
  {
    id: 'herbaceous',
    name: 'Herbaceous Vegetation',
    count: 3000,
    studyCount: 2400,
    holdoutCount: 600,
    percentage: 11.1,
    clusterId: 7,
    clusterName: 'Group 08 · Herbaceous Vegetation',
    purity: '39.5% in Group 08',
    color: 'var(--color-cluster-7)',
    description: 'Natural grasslands, wild meadows, and non-forested vegetation.',
    visualFeatures: 'Mid-range green hue, smooth spatial texture, moderate saturation.',
  },
  {
    id: 'river',
    name: 'River & Waterways',
    count: 2500,
    studyCount: 2000,
    holdoutCount: 500,
    percentage: 9.3,
    clusterId: 3,
    clusterName: 'Group 04 · River & Waterways',
    purity: '28.9% in Group 04',
    color: 'var(--color-cluster-3)',
    description: 'Natural winding river channels, canals, and riparian stream corridors.',
    visualFeatures: 'Linear spatial waterways with distinct contrast between water and banks.',
  },
  {
    id: 'highway',
    name: 'Highways & Transit',
    count: 2500,
    studyCount: 2000,
    holdoutCount: 500,
    percentage: 9.3,
    clusterId: 9,
    clusterName: 'Group 10 & Group 04 · Transportation',
    purity: 'Linear infrastructure',
    color: 'var(--color-cluster-1)',
    description: 'Interstate motorways, highway junctions, and high-speed rail lines.',
    visualFeatures: 'High directional edge contrast, dark paved asphalt linear tracks.',
  },
  {
    id: 'industrial',
    name: 'Industrial Buildings',
    count: 2500,
    studyCount: 2000,
    holdoutCount: 500,
    percentage: 9.3,
    clusterId: 1,
    clusterName: 'Group 02 · Industrial Buildings',
    purity: '62.9% in Group 02',
    color: 'var(--color-cluster-1)',
    description: 'Large commercial warehouses, factories, and industrial facilities.',
    visualFeatures: 'Extremely high GLCM texture contrast and large reflective metal roofs.',
  },
  {
    id: 'permanent_crop',
    name: 'Permanent Crops',
    count: 2500,
    studyCount: 2000,
    holdoutCount: 500,
    percentage: 9.3,
    clusterId: 5,
    clusterName: 'Group 06 · Permanent Crops',
    purity: 'Orchards & groves',
    color: 'var(--color-cluster-5)',
    description: 'Fruit orchards, olive groves, vineyards, and permanent tree crops.',
    visualFeatures: 'Periodic spatial striping, regular tree row intervals, bright ground reflection.',
  },
  {
    id: 'pasture',
    name: 'Pasture & Grassland',
    count: 2000,
    studyCount: 1600,
    holdoutCount: 400,
    percentage: 7.4,
    clusterId: 8,
    clusterName: 'Group 09 · Pasture & Grassland',
    purity: 'Grazing lands',
    color: 'var(--color-cluster-8)',
    description: 'Enclosed grazing pastures, agricultural meadows, and farm paddocks.',
    visualFeatures: 'Homogeneous green fields with distinct hedgerows and livestock fencing.',
  },
];

export default function ClassDistribution() {
  const [activeClass, setActiveClass] = useState<ClassItem>(EUROSAT_CLASSES[0]);
  const [splitMode, setSplitMode] = useState<'total' | 'cohorts'>('total');

  const totalPatches = 27000;
  const maxCount = 3000;

  return (
    <Panel
      title="Class Distribution Breakdown"
      detail="Total 27,000 patches across 10 land cover classes · ESA Sentinel-2 European Imagery"
      className="class-distribution-panel"
      action={
        <div className="segment-control">
          <button
            type="button"
            onClick={() => setSplitMode('total')}
            aria-pressed={splitMode === 'total'}
          >
            <span>Total 27,000</span>
          </button>
          <button
            type="button"
            onClick={() => setSplitMode('cohorts')}
            aria-pressed={splitMode === 'cohorts'}
          >
            <span>80 / 20 Split</span>
          </button>
        </div>
      }
    >
      {/* Top statistics ribbon */}
      <div className="class-summary-banner">
        <div>
          <span>Total Images</span>
          <strong>27,000<small>RGB patches</small></strong>
        </div>
        <div>
          <span>Land Categories</span>
          <strong>10<small>EuroSAT classes</small></strong>
        </div>
        <div>
          <span>Study Cohort</span>
          <strong>21,600<small>80% label-blind</small></strong>
        </div>
        <div>
          <span>Reserved Holdout</span>
          <strong>5,400<small>20% test audit</small></strong>
        </div>
        <div>
          <span>Ground Resolution</span>
          <strong>10 m<small>per pixel (64×64)</small></strong>
        </div>
      </div>

      {/* Proportional Segmented Color Ribbon */}
      <div className="class-ribbon-wrap" aria-label="Proportional land class ribbon">
        <div className="class-ribbon">
          {EUROSAT_CLASSES.map(cls => (
            <div
              key={cls.id}
              className={`class-ribbon-segment ${activeClass.id === cls.id ? 'is-selected' : ''}`}
              style={{
                width: `${(cls.count / totalPatches) * 100}%`,
                background: cls.color,
              }}
              onMouseEnter={() => setActiveClass(cls)}
              onClick={() => setActiveClass(cls)}
              title={`${cls.name}: ${format(cls.count, 0)} patches (${cls.percentage}%)`}
            />
          ))}
        </div>
        <div className="class-ribbon-legend">
          <span>Continuous European Land-Cover Spectrum (Sentinel-2 MSI)</span>
          <span>Click or hover any segment to inspect</span>
        </div>
      </div>

      {/* Interactive 2-Column Layout: Class List + Active Inspector */}
      <div className="class-inspector-grid">
        {/* Class List with visual percentage meters */}
        <div className="class-list" role="list">
          {EUROSAT_CLASSES.map(cls => {
            const isSelected = activeClass.id === cls.id;
            const barWidth = (cls.count / maxCount) * 100;

            return (
              <button
                key={cls.id}
                type="button"
                className={`class-item-row ${isSelected ? 'is-selected' : ''}`}
                onClick={() => setActiveClass(cls)}
                onMouseEnter={() => setActiveClass(cls)}
              >
                <span className="class-dot" style={{ background: cls.color }}/>
                <span className="class-identity">
                  <strong>{cls.name}</strong>
                  <small>{cls.clusterName}</small>
                </span>

                <div className="class-meter-track">
                  <div
                    className="class-meter-fill"
                    style={{ width: `${barWidth}%`, background: cls.color }}
                  />
                </div>

                <div className="class-numbers">
                  <strong>{format(splitMode === 'total' ? cls.count : cls.studyCount, 0)}</strong>
                  <small>{splitMode === 'total' ? `${cls.percentage}%` : 'study'}</small>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Inspector Card for the selected class */}
        <div className="class-detail-card">
          <div className="class-detail-header">
            <span className="class-badge" style={{ background: activeClass.color }}/>
            <div>
              <span className="workspace-label">EuroSAT Ground Truth Category</span>
              <h3>{activeClass.name}</h3>
              <p>{activeClass.description}</p>
            </div>
          </div>

          <div className="class-metrics-grid">
            <div>
              <span>Total Dataset Patches</span>
              <strong>{format(activeClass.count, 0)}</strong>
              <small>{activeClass.percentage}% of EuroSAT</small>
            </div>
            <div>
              <span>Study / Holdout Split</span>
              <strong>{format(activeClass.studyCount, 0)} / {format(activeClass.holdoutCount, 0)}</strong>
              <small>80% study · 20% holdout</small>
            </div>
            <div>
              <span>Ground Area Covered</span>
              <strong>40.96 ha<small>/patch</small></strong>
              <small>{format(activeClass.count * 0.4096, 1)} km² total</small>
            </div>
            <div>
              <span>Unsupervised Alignment</span>
              <strong>{activeClass.purity}</strong>
              <small>{activeClass.clusterName}</small>
            </div>
          </div>

          <div className="class-feature-highlight">
            <div className="highlight-title">
              <Sparkle size={15}/>
              <span>Visual Signature in Extracted Features</span>
            </div>
            <p>{activeClass.visualFeatures}</p>
          </div>

          <div className="class-method-note">
            <Info size={16}/>
            <p>
              <strong>Methodology Note:</strong> These ground-truth labels were strictly withheld during feature scaling, PCA, and K-Means. The clustering algorithm discovered these groupings purely through visual texture and color distributions.
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
