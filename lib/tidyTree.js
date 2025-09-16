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
    this.nodeWidth = options.nodeWidth || 290;
    this.nodeHeight = options.nodeHeight || 80;
    this.levelHeight = options.levelHeight || 120;
    this.siblingDistance = options.siblingDistance || 40;
    this.subtreeDistance = options.subtreeDistance || 60;
    this.spacingReduction = options.spacingReduction || 0.7; // Factor to reduce spacing by each level
    this.minSpacing = options.minSpacing || 60; // Minimum spacing to maintain
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
    const dynamicSpacing = this.getDynamicSpacing(node, this.siblingDistance);
    
    if (node.isLeaf()) {
      // Leaf node
      const leftSibling = node.getLeftSibling();
      if (leftSibling) {
        node.prelim = leftSibling.prelim + this.nodeWidth + dynamicSpacing;
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
        node.prelim = leftSibling.prelim + this.nodeWidth + dynamicSpacing;
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

      const dynamicSubtreeDistance = this.getDynamicSpacing(node, this.subtreeDistance);
      const shift = (vil.prelim + sil) - (vir.prelim + sir) + this.nodeWidth + dynamicSubtreeDistance;
      
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
   * Create layout data structure
   */
  createLayout(root, bounds) {
    const nodes = [];
    const edges = [];

    const traverse = (node) => {
      // Adjust coordinates to start from 0
      const adjustedX = node.x - bounds.minX;
      const adjustedY = node.y;

      nodes.push({
        id: node.id,
        data: node.data,
        x: adjustedX,
        y: adjustedY,
        width: this.nodeWidth,
        height: this.nodeHeight
      });

      // Create edges to children
      node.children.forEach(child => {
        const childX = child.x - bounds.minX;
        const childY = child.y;

        edges.push({
          from: node.id,
          to: child.id,
          fromX: adjustedX + this.nodeWidth / 2,
          fromY: adjustedY + this.nodeHeight,
          toX: childX + this.nodeWidth / 2,
          toY: childY
        });

        traverse(child);
      });
    };

    traverse(root);

    return {
      nodes,
      edges,
      bounds: {
        width: bounds.width,
        height: bounds.height
      }
    };
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