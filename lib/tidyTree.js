/**
 * Tidy Tree Algorithm Implementation
 * Based on the algorithm described in "Tidier Drawings of Trees" by Edward M. Reingold and John S. Tilford
 */

export class TreeNode {
  constructor(data, id) {
    this.data = data;
    this.id = id;
    this.children = [];
    this.parent = null;
    
    // Layout properties
    this.x = 0;
    this.y = 0;
    this.prelim = 0;
    this.mod = 0;
    this.shift = 0;
    this.change = 0;
    this.thread = null;
    this.ancestor = this;
    this.number = 0;
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  isLeaf() {
    return this.children.length === 0;
  }

  isLeftmost() {
    return this.parent && this.parent.children[0] === this;
  }

  isRightmost() {
    return this.parent && this.parent.children[this.parent.children.length - 1] === this;
  }

  getLeftSibling() {
    if (!this.parent) return null;
    const index = this.parent.children.indexOf(this);
    return index > 0 ? this.parent.children[index - 1] : null;
  }

  getRightSibling() {
    if (!this.parent) return null;
    const index = this.parent.children.indexOf(this);
    return index < this.parent.children.length - 1 ? this.parent.children[index + 1] : null;
  }

  getLeftmostChild() {
    return this.children.length > 0 ? this.children[0] : null;
  }

  getRightmostChild() {
    return this.children.length > 0 ? this.children[this.children.length - 1] : null;
  }
}

export class TidyTree {
  constructor(options = {}) {
    this.nodeWidth = options.nodeWidth || 250;
    this.nodeHeight = options.nodeHeight || 80;
    this.levelHeight = options.levelHeight || 120;
    this.siblingDistance = options.siblingDistance ?? 24; // Increased to ensure no overlap
    this.subtreeDistance = options.subtreeGap ?? 40; 
    this.spacingReduction = options.spacingReduction || 0.92; // Even less aggressive reduction
    this.minSpacing = options.minSpacing || 16; // Further increased minimum spacing
  }



  /**
   * Build tree from hierarchical data
   */
  buildTree(groups, rootId = null) {
    const nodeMap = new Map();
    
    // Create nodes
    groups.forEach(group => {
      nodeMap.set(group.id, new TreeNode(group, group.id));
    });

    // Build hierarchy
    let roots = [];
    groups.forEach(group => {
      const node = nodeMap.get(group.id);
      if (group.parent_group_id && nodeMap.has(group.parent_group_id)) {
        const parent = nodeMap.get(group.parent_group_id);
        parent.addChild(node);
      } else {
        roots.push(node);
      }
    });

    // Number children for each node
    this.numberChildren(roots);

    return { roots, nodeMap };
  }

  /**
   * Number children from left to right
   */
  numberChildren(nodes) {
    nodes.forEach(node => {
      this.numberChildrenRecursive(node);
    });
  }

  numberChildrenRecursive(node) {
    node.children.forEach((child, index) => {
      child.number = index;
      this.numberChildrenRecursive(child);
    });
  }

  /**
   * Calculate dynamic spacing based on tree depth
   */
  getDynamicSpacing(node, baseSpacing) {
    let depth = 0;
    let current = node;
    while (current.parent) {
      depth++;
      current = current.parent;
    }
    
    const reducedSpacing = baseSpacing * Math.pow(this.spacingReduction, depth);
    return Math.max(reducedSpacing, this.minSpacing);
  }

  /**
   * Main layout algorithm
   */
  layout(roots) {
    const layouts = [];

    roots.forEach(root => {
      console.log(`Processing root: ${root.data.name}`);
      
      // First walk: compute preliminary x coordinates
      this.firstWalk(root);
      
      // Second walk: compute final coordinates
      this.secondWalk(root, -root.prelim);
      
      // Calculate bounds and create layout
      const bounds = this.calculateBounds(root);
      const layout = this.createLayout(root, bounds);
      
      console.log(`Layout bounds: width=${bounds.width}, height=${bounds.height}`);
      console.log(`Node positions:`, layout.nodes.map(n => ({ name: n.data.name, x: n.x, y: n.y })));
      
      layouts.push(layout);
    });

    return layouts;
  }

  /**
   * First walk: compute preliminary x coordinates and modifiers
   */
  firstWalk(node) {
    if (node.isLeaf()) {
      // Leaf node - use fixed large spacing
      const leftSibling = node.getLeftSibling();
      if (leftSibling) {
        // Use a much larger fixed spacing to guarantee no overlaps
        const fixedSpacing = Math.max(this.siblingDistance, this.nodeWidth + 50);
        node.prelim = leftSibling.prelim + fixedSpacing;
      } else {
        node.prelim = 0;
      }
    } else {
      // Internal node
      let defaultAncestor = node.getLeftmostChild();
      
      node.children.forEach(child => {
        this.firstWalk(child);
        defaultAncestor = this.apportion(child, defaultAncestor);
      });

      this.executeShifts(node);

      const midpoint = (node.getLeftmostChild().prelim + node.getRightmostChild().prelim) / 2;
      const leftSibling = node.getLeftSibling();
      
      if (leftSibling) {
        // Use a much larger fixed spacing to guarantee no overlaps
        const fixedSpacing = Math.max(this.siblingDistance, this.nodeWidth + 100);
        node.prelim = leftSibling.prelim + fixedSpacing;
        node.mod = node.prelim - midpoint;
      } else {
        node.prelim = midpoint;
      }
    }
  }

  /**
   * Apportion: resolve conflicts between subtrees
   */
  apportion(node, defaultAncestor) {
    const leftSibling = node.getLeftSibling();
    if (!leftSibling) return defaultAncestor;

    let vir = node;
    let vor = node;
    let vil = leftSibling;
    let vol = node.parent.getLeftmostChild();

    let sir = node.mod;
    let sor = node.mod;
    let sil = vil.mod;
    let sol = vol.mod;

    while (this.nextRight(vil) && this.nextLeft(vir)) {
      vil = this.nextRight(vil);
      vir = this.nextLeft(vir);
      vol = this.nextLeft(vol);
      vor = this.nextRight(vor);
      vor.ancestor = node;

      // Use very large fixed spacing to guarantee no overlaps
      const largeGap = Math.max(this.subtreeDistance, this.nodeWidth + 150);
      const shift = (vil.prelim + sil) - (vir.prelim + sir) + largeGap;
      
      if (shift > 0) {
        this.moveSubtree(this.ancestor(vil, node, defaultAncestor), node, shift);
        sir += shift;
        sor += shift;
      }

      sil += vil.mod;
      sir += vir.mod;
      sol += vol.mod;
      sor += vor.mod;
    }

    if (this.nextRight(vil) && !this.nextRight(vor)) {
      vor.thread = this.nextRight(vil);
      vor.mod += sil - sor;
    }

    if (this.nextLeft(vir) && !this.nextLeft(vol)) {
      vol.thread = this.nextLeft(vir);
      vol.mod += sir - sol;
      defaultAncestor = node;
    }

    return defaultAncestor;
  }

  /**
   * Move subtree
   */
  moveSubtree(wl, wr, shift) {
    const subtrees = wr.number - wl.number;
    wr.change -= shift / subtrees;
    wr.shift += shift;
    wl.change += shift / subtrees;
  }

  /**
   * Execute shifts
   */
  executeShifts(node) {
    let shift = 0;
    let change = 0;
    
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i];
      child.prelim += shift;
      child.mod += shift;
      change += child.change;
      shift += child.shift + change;
    }
  }

  /**
   * Get ancestor
   */
  ancestor(vil, node, defaultAncestor) {
    return node.parent.children.includes(vil.ancestor) ? vil.ancestor : defaultAncestor;
  }

  /**
   * Get next left node
   */
  nextLeft(node) {
    return node.children.length > 0 ? node.children[0] : node.thread;
  }

  /**
   * Get next right node
   */
  nextRight(node) {
    return node.children.length > 0 ? node.children[node.children.length - 1] : node.thread;
  }

  /**
   * Second walk: compute final coordinates
   */
  secondWalk(node, m) {
    node.x = node.prelim + m;
    node.y = node.parent ? node.parent.y + this.levelHeight : 0;

    node.children.forEach(child => {
      this.secondWalk(child, m + node.mod);
    });
  }

  /**
   * Calculate bounds of the tree
   */
  calculateBounds(root) {
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const traverse = (node) => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x + this.nodeWidth);
      maxY = Math.max(maxY, node.y + this.nodeHeight);
      
      node.children.forEach(traverse);
    };

    traverse(root);

    return {
      minX,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY + this.nodeHeight
    };
  }



/**
 * Shift a node and all its descendants by dx
 */
shiftSubtree(nodeId, dx, nodes) {
  const queue = [nodeId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    const current = nodes.find(n => n.id === currentId);
    if (current) {
      current.x += dx;
      queue.push(...current.children);
    }
  }
}

/**
 * Create layout data structure (final)
 * - Enforces sibling spacing with a cursor (no overlaps)
 * - Recenters each parent over its children (bottom-up)
 * - Recalculates bounds after shifts
 * - Normalizes X so the leftmost node is at x = 0
 */
createLayout(root, _oldBounds) {
  // 1) Collect nodes using RAW coordinates (no offset yet)
  let nodes = [];
  const collectNodes = (node) => {
    nodes.push({
      id: node.id,
      data: node.data,
      x: node.x,                // raw
      y: node.y,                // raw
      width: this.nodeWidth,
      height: this.nodeHeight,
      parentId: node.parent ? node.parent.id : null,
      children: node.children.map(c => c.id),
    });
    node.children.forEach(collectNodes);
  };
  collectNodes(root);

  // 2) Bottom-up: fix each subtree, then recenter parent
  const fixSubtree = (nodeId) => {
    const parent = nodes.find(n => n.id === nodeId);
    if (!parent) return;

    const children = parent.children
      .map(cid => nodes.find(n => n.id === cid))
      .filter(Boolean);

    // Recurse first (bottom-up)
    children.forEach(ch => fixSubtree(ch.id));

    if (children.length > 0) {
      // --- Strong sibling spacing with cursor ---
      children.sort((a, b) => a.x - b.x);

      let cursor = children[0].x;
     // inside createLayout -> fixSubtree:
      const gap = (this.nodeWidth || 250) + 80; // try +80 or +100 until overlap disappears


      for (let i = 1; i < children.length; i++) {
        const curr = children[i];
        const minX = cursor + gap;
        if (curr.x < minX) {
          const dx = minX - curr.x;
          this.shiftSubtree(curr.id, dx, nodes);
          curr.x += dx;      // keep local cache in sync
        }
        cursor = curr.x;
      }

      // --- Recenter parent above its children span ---
      const leftmost = children[0];
      const rightmost = children[children.length - 1];
      const childrenMid = (leftmost.x + rightmost.x) / 2;
      const parentCenter = parent.x + this.nodeWidth / 2;
      const dxParent = childrenMid - parentCenter;

      if (Math.abs(dxParent) > 0.01) {
        this.shiftSubtree(parent.id, dxParent, nodes);
        parent.x += dxParent;  // keep local cache in sync
      }
    }
  };

  fixSubtree(root.id);

  // 3) Recalculate bounds AFTER all shifts
  let { minX, maxX, maxY, width, height } = this.recalculateBounds(nodes);

  // 4) Normalize X so the left edge starts at 0
  if (minX !== 0) {
    const normalizeDx = -minX;
    nodes.forEach(n => { n.x += normalizeDx; });
    // Recompute bounds after normalization
    ({ minX, maxX, maxY, width, height } = this.recalculateBounds(nodes));
  }

  // 5) Build edges from the (normalized) nodes
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges = [];
  nodes.forEach(n => {
    if (!n.parentId) return;
    const p = byId.get(n.parentId);
    if (!p) return;
    edges.push({
      from: p.id,
      to: n.id,
      fromX: p.x + this.nodeWidth / 2,
      fromY: p.y + this.nodeHeight,
      toX: n.x + this.nodeWidth / 2,
      toY: n.y,
    });
  });

  return {
    nodes,
    edges,
    bounds: { minX, maxX, maxY, width, height },
  };
}

/**
 * Shift a node and all its descendants by dx
 */
shiftSubtree(nodeId, dx, nodes) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const queue = [nodeId];
  while (queue.length) {
    const id = queue.shift();
    const n = byId.get(id);
    if (!n) continue;
    n.x += dx;
    for (const cid of n.children) queue.push(cid);
  }
}

/**
 * Bounds after adjustments (no Y normalization)
 */
recalculateBounds(nodes) {
  const minX = Math.min(...nodes.map(n => n.x));
  const maxX = Math.max(...nodes.map(n => n.x + n.width));
  const maxY = Math.max(...nodes.map(n => n.y + n.height));
  return {
    minX,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY,
  };
}



/**
 * Utility to check if a node is a descendant of another
 */
isDescendant(node, potentialAncestor, nodes) {
  let current = node;
  while (current.parentId) {
    if (current.parentId === potentialAncestor.id) return true;
    current = nodes.find(n => n.id === current.parentId);
  }
  return false;
}


  /**
   * Generate SVG path for edge
   */
  generateEdgePath(edge) {
    const { fromX, fromY, toX, toY } = edge;
    const midY = (fromY + toY) / 2;
    
    return `M ${fromX},${fromY} V ${midY} H ${toX} V ${toY}`;
  }
}

/**
 * Utility function to create tree layout from groups data
 */
export function createTreeLayout(groups, options = {}) {
  const tree = new TidyTree(options);
  const { roots } = tree.buildTree(groups);
  return tree.layout(roots);
}