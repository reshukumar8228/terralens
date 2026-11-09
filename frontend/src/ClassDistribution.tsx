import { useState } from 'react';
import { ShieldCheck, Sparkle } from '@phosphor-icons/react';
import { format, percent } from './api';
import { clusterColor } from './Charts';
import { Panel } from './UI';

export interface ClassInfo {
  id: string;
  name: string;
  total: number;
  study: number;
  holdout: number;
  clusterId: number;
  icon: string;
  spectral: string;
  mappedGroup: string;
}

export const DATASET_CLASSES: ClassInfo[] = [
  { id: 'AnnualCrop', name: 'Annual Crop', total: 3000, study: 2414, holdout: 586, clusterId: 4, icon: '🌾', spectral: 'Regular agricultural crop fields with seasonal bare-earth plowing patterns and cyclic NDVI vegetation variance.', mappedGroup: 'Group 05 · Annual Crops' },
  { id: 'Forest', name: 'Forest', total: 3000, study: 2360, holdout: 640, clusterId: 2, icon: '🌲', spectral: 'Dense deciduous and coniferous canopies with high green saturation, high infrared absorption, and fine LBP texture.', mappedGroup: 'Group 03 · Forest' },
  { id: 'HerbaceousVegetation', name: 'Herbaceous Vegetation', total: 3000, study: 2425, holdout: 575, clusterId: 7, icon: '🌿', spectral: 'Natural grasslands and unmanaged meadows displaying moderate vegetation index and low spatial contrast.', mappedGroup: 'Group 08 · Herbaceous Vegetation' },
  { id: 'Highway', name: 'Highway', total: 2500, study: 2040, holdout: 460, clusterId: 3, icon: '🛣️', spectral: 'Linear transport corridors with strong directional edge gradients and dark asphalt/concrete spectral response.', mappedGroup: 'Group 04 · River & Waterways / Highways' },
  { id: 'Industrial', name: 'Industrial Buildings', total: 2500, study: 1969, holdout: 531, clusterId: 1, icon: '🏭', spectral: 'High texture contrast, large reflective warehouse roofs, sharp geometric boundaries, and low vegetation.', mappedGroup: 'Group 02 · Industrial Buildings' },
  { id: 'Pasture', name: 'Pasture', total: 2000, study: 1584, holdout: 416, clusterId: 8, icon: '🌱', spectral: 'Managed grazing grasslands with uniform green hue distribution and smooth local binary patterns.', mappedGroup: 'Group 09 · Pasture & Grassland' },
  { id: 'PermanentCrop', name: 'Permanent Crop', total: 2500, study: 2026, holdout: 474, clusterId: 5, icon: '🍇', spectral: 'Vineyards, orchards, and olive groves with structured row geometry, bright soil alleys, and periodic textures.', mappedGroup: 'Group 06 · Permanent Crops' },
  { id: 'Residential', name: 'Residential Buildings', total: 3000, study: 2387, holdout: 613, clusterId: 9, icon: '🏡', spectral: 'Dense clusters of small roofs, suburban street networks, mixed garden vegetation, and medium edge density.', mappedGroup: 'Group 10 · Residential Buildings' },
  { id: 'River', name: 'River', total: 2500, study: 1977, holdout: 523, clusterId: 3, icon: '🌊', spectral: 'Winding, low-reflectance water channels surrounded by riparian vegetation corridors and distinct linear edges.', mappedGroup: 'Group 04 · River & Waterways' },
  { id: 'SeaLake', name: 'Sea & Lake', total: 3000, study: 2418, holdout: 582, clusterId: 6, icon: '⛵', spectral: 'Deep water absorption, near-zero near-infrared reflectance, uniform low variance across all colour channels.', mappedGroup: 'Group 07 · Deep Water & Group 01 · Wetlands' },
];

export default function ClassDistributionBreakdown() {
  const [activeCohort, setActiveCohort] = useState<'total' | 'study' | 'holdout'>('total');
  const [hoveredClass, setHoveredClass] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassInfo>(DATASET_CLASSES[0]);
  const [showTeacherGuide, setShowTeacherGuide] = useState(false);

  const totalPatches = activeCohort === 'total' ? 27000 : activeCohort === 'study' ? 21600 : 5400;
  const activeClass = hoveredClass ? DATASET_CLASSES.find(c => c.id === hoveredClass) || selectedClass : selectedClass;

  return (
    <Panel
      title="Class Distribution Breakdown"
      detail="Total 27,000 patches across 10 land cover classes in EuroSAT"
      className="class-distribution-panel"
      action={
        <div className="distribution-cohort-toggles" role="group" aria-label="Select dataset cohort view">
          <button
            className={`cohort-toggle-btn ${activeCohort === 'total' ? 'is-active' : ''}`}
            onClick={() => setActiveCohort('total')}
          >
            All 27,000 Patches
          </button>
          <button
            className={`cohort-toggle-btn ${activeCohort === 'study' ? 'is-active' : ''}`}
            onClick={() => setActiveCohort('study')}
          >
            Study Cohort (21,600 · 80%)
          </button>
          <button
            className={`cohort-toggle-btn ${activeCohort === 'holdout' ? 'is-active' : ''}`}
            onClick={() => setActiveCohort('holdout')}
          >
            Reserved Holdout (5,400 · 20%)
          </button>
        </div>
      }
    >
      {/* Metric Highlights Strip */}
      <div className="distribution-stats-strip">
        <div className="dist-stat-item">
          <span>Total Observations</span>
          <strong>{format(totalPatches, 0)}</strong>
          <small>{activeCohort === 'total' ? 'Full EuroSAT Benchmark' : activeCohort === 'study' ? '80% Disjoint Training Set' : '20% Label-Blind Test Set'}</small>
        </div>
        <div className="dist-stat-item">
          <span>Distinct Land Classes</span>
          <strong>10 Categories</strong>
          <small>Urban, Vegetative, Agricultural & Aquatic</small>
        </div>
        <div className="dist-stat-item">
          <span>Class Balance Ratio</span>
          <strong>Near-Uniform</strong>
          <small>2,000 – 3,000 patches per class (7.4% – 11.1%)</small>
        </div>
        <div className="dist-stat-item">
          <span>Spatial Resolution</span>
          <strong>10 m / pixel</strong>
          <small>Sentinel-2 MSI · 64 × 64 px (640m × 640m)</small>
        </div>
      </div>

      {/* Visual Segmented Spectrum Bar */}
      <div className="distribution-spectrum-shell" role="region" aria-label="Interactive class distribution spectrum">
        <div className="spectrum-label-row">
          <span>Proportional Class Spectrum</span>
          <span className="spectrum-interactive-hint">Hover or select any category to inspect its details</span>
        </div>
        <div className="distribution-spectrum-bar">
          {DATASET_CLASSES.map(c => {
            const count = activeCohort === 'total' ? c.total : activeCohort === 'study' ? c.study : c.holdout;
            const widthPct = (count / totalPatches) * 100;
            const isHovered = activeClass.id === c.id;
            return (
              <div
                key={c.id}
                className={`spectrum-segment ${isHovered ? 'is-hovered' : ''}`}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: clusterColor(c.clusterId),
                }}
                onPointerEnter={() => setHoveredClass(c.id)}
                onPointerLeave={() => setHoveredClass(null)}
                onClick={() => setSelectedClass(c)}
                title={`${c.name}: ${format(count, 0)} patches (${percent(count / totalPatches)})`}
              >
                {widthPct > 8 && <span className="segment-short-name">{c.name.split(' ')[0]}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Class Cards Grid */}
      <div className="distribution-cards-grid">
        {DATASET_CLASSES.map(c => {
          const count = activeCohort === 'total' ? c.total : activeCohort === 'study' ? c.study : c.holdout;
          const share = count / totalPatches;
          const isSelected = activeClass.id === c.id;
          return (
            <button
              key={c.id}
              className={`distribution-card ${isSelected ? 'is-selected' : ''}`}
              onPointerEnter={() => setHoveredClass(c.id)}
              onPointerLeave={() => setHoveredClass(null)}
              onClick={() => setSelectedClass(c)}
              aria-pressed={isSelected}
            >
              <div className="dist-card-header">
                <span className="dist-card-icon" style={{ borderColor: clusterColor(c.clusterId) }}>
                  <span className="colour-dot" style={{ background: clusterColor(c.clusterId) }}/>
                  {c.icon}
                </span>
                <span className="dist-card-share">{percent(share, 1)}</span>
              </div>
              <strong className="dist-card-name">{c.name}</strong>
              <div className="dist-card-count">
                <span>{format(count, 0)}</span>
                <small>patches</small>
              </div>
              <div className="dist-card-track">
                <div
                  className="dist-card-fill"
                  style={{
                    width: `${(count / 3000) * 100}%`,
                    backgroundColor: clusterColor(c.clusterId),
                  }}
                />
              </div>
              <div className="dist-card-split-label">
                <span>{format(c.study, 0)} study</span>
                <span>{format(c.holdout, 0)} holdout</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Class Detailed Inspection Callout */}
      <div className="distribution-inspector-card">
        <div className="inspector-card-left">
          <div className="inspector-class-badge" style={{ backgroundColor: clusterColor(activeClass.clusterId) }}>
            <span>{activeClass.icon}</span>
          </div>
          <div>
            <span className="workspace-label">EuroSAT Ground-Truth Class</span>
            <h3>{activeClass.name}</h3>
            <p className="caption">
              <strong>{format(activeClass.total, 0)} patches</strong> across dataset · {format(activeClass.study, 0)} in study cohort (80%) · {format(activeClass.holdout, 0)} reserved (20%)
            </p>
          </div>
        </div>
        <div className="inspector-card-right">
          <div className="inspector-info-block">
            <strong>Spectral & Spatial Signature</strong>
            <p>{activeClass.spectral}</p>
          </div>
          <div className="inspector-info-block">
            <strong>Unsupervised Cluster Alignment</strong>
            <p className="mapped-group-pill">
              <span className="colour-dot" style={{ background: clusterColor(activeClass.clusterId) }}/>
              {activeClass.mappedGroup}
            </p>
          </div>
        </div>
      </div>

      {/* Teacher / Capstone Viva Guide Toggle */}
      <div className="teacher-viva-section">
        <button
          className="teacher-viva-toggle"
          onClick={() => setShowTeacherGuide(v => !v)}
          aria-expanded={showTeacherGuide}
        >
          <Sparkle size={18} weight="fill"/>
          <span><strong>Teacher Explanation & Viva Insight:</strong> Why is balanced class distribution crucial for unsupervised clustering?</span>
          <span className="viva-toggle-icon">{showTeacherGuide ? '− Hide defense guide' : '+ Show defense guide'}</span>
        </button>

        {showTeacherGuide && (
          <div className="teacher-viva-content">
            <div className="viva-columns">
              <div className="viva-point">
                <h4>1. Prevents Centroid Monopoly</h4>
                <p>
                  In unsupervised K-Means, the objective function minimizes inertia: <code>Σ ||x_i - μ_k||²</code>. If one land class had 20,000 patches and another had 500, K-Means would allocate 8 or 9 clusters to subdivide the majority class, while merging or ignoring the minority class. EuroSAT's near-balanced distribution (~2,500 patches per class) guarantees equal geometric pressure in feature space.
                </p>
              </div>
              <div className="viva-point">
                <h4>2. Validates True Multimodal Structure</h4>
                <p>
                  Because all 10 land cover types are equally represented, the discovered clusters reflect genuine feature separability (e.g., optical reflectance, GLCM texture, LBP structure) rather than artifactual sample frequency imbalances.
                </p>
              </div>
              <div className="viva-point">
                <h4>3. Statistically Robust Post-Hoc Audit</h4>
                <p>
                  The separate 20% holdout split (5,400 patches) preserves the exact same class proportions. When computing Adjusted Rand Index (ARI) and contingency matrices after model selection, every land-cover category has adequate statistical power for rigorous evaluation.
                </p>
              </div>
            </div>
            <div className="viva-footer-note">
              <ShieldCheck size={16}/>
              <span><strong>Key Viva Takeaway:</strong> We do not feed these 10 labels to the clustering algorithms. They exist solely for post-hoc validation to prove our unsupervised pipeline discovered natural land-cover boundaries autonomously.</span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
