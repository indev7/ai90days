'use client';

import React, { useState } from 'react';
import { OrganizationChart } from 'primereact/organizationchart';
import styles from './page.module.css';

export default function SharedHierarchyView() {
  const [data] = useState([
    {
      label: 'Argentina',
      expanded: true,
      children: [
        {
          label: 'Argentina',
          expanded: true,
          children: [
            {
              label: 'Argentina',
            },
            {
              label: 'Croatia',
            },
          ],
        },
        {
          label: 'France',
          expanded: true,
          children: [
            {
              label: 'France',
            },
            {
              label: 'Morocco',
            },
          ],
        },
      ],
    },
  ]);

  const renderNode = (node) => (
    <div className={styles.hNode}>
      <div className={styles.hTitle}>{node.label}</div>
    </div>
  );

  return (
    <div className={styles.hierarchyBlank}>
      <OrganizationChart value={data} nodeTemplate={renderNode} className={styles.orgChart} />
    </div>
  );
}
