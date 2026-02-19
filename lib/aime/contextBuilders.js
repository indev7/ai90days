// Build a unique, sorted member directory from group memberships.
export function buildMemberDirectory(mainTree) {
  const groups = Array.isArray(mainTree?.groups) ? mainTree.groups : [];
  const byKey = new Map();

  groups.forEach((group) => {
    const members = Array.isArray(group?.members) ? group.members : [];
    members.forEach((member) => {
      if (!member) return;
      const id = member.id ?? null;
      const email = member.email ?? null;
      const key = id != null ? `id:${id}` : email ? `email:${email}` : null;
      if (!key) return;
      if (byKey.has(key)) return;
      byKey.set(key, {
        id,
        first_name: member.first_name ?? null,
        last_name: member.last_name ?? null,
        email
      });
    });
  });

  const list = Array.from(byKey.values());
  list.sort((a, b) => {
    const aKey = (a.email || `${a.first_name || ''} ${a.last_name || ''}`).trim().toLowerCase();
    const bKey = (b.email || `${b.first_name || ''} ${b.last_name || ''}`).trim().toLowerCase();
    return aKey.localeCompare(bKey);
  });
  return list;
}

// Resolve a group name to its ancestor and descendant visibility chain.
export function objectiveGroupVisibilityChain(mainTree, groupName) {
  const groups = Array.isArray(mainTree?.groups) ? mainTree.groups : [];
  const normalized = (groupName || '').trim().toLowerCase();
  if (!normalized || groups.length === 0) return [];

  const byId = new Map();
  const childrenById = new Map();
  groups.forEach((group) => {
    if (!group || group.id == null) return;
    byId.set(group.id, group);
    const parentId = group.parent_group_id;
    if (parentId === null || parentId === undefined) return;
    if (!childrenById.has(parentId)) {
      childrenById.set(parentId, []);
    }
    childrenById.get(parentId).push(group.id);
  });

  const matches = groups.filter((group) => {
    const name = (group?.name || '').trim().toLowerCase();
    return name === normalized;
  });
  if (matches.length === 0) return [];

  const linkedById = new Map();
  const pushLinked = (group) => {
    if (!group || group.id == null) return;
    if (linkedById.has(group.id)) return;
    linkedById.set(group.id, { id: group.id, name: group.name ?? '' });
  };

  const addAncestors = (startGroup) => {
    const chain = [];
    let current = startGroup;
    const visited = new Set();
    while (current && current.id != null && !visited.has(current.id)) {
      visited.add(current.id);
      chain.push(current);
      const parentId = current.parent_group_id;
      current = parentId != null ? byId.get(parentId) : null;
    }
    chain.reverse().forEach(pushLinked);
  };

  const addDescendants = (startGroup) => {
    const stack = [startGroup.id];
    const visited = new Set();
    while (stack.length > 0) {
      const currentId = stack.pop();
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const current = byId.get(currentId);
      if (current) pushLinked(current);
      const children = childrenById.get(currentId) || [];
      for (let i = children.length - 1; i >= 0; i -= 1) {
        stack.push(children[i]);
      }
    }
  };

  const primary = matches[0];
  addAncestors(primary);
  addDescendants(primary);

  return Array.from(linkedById.values());
}

// Collect members who can see an objective via shared group visibility.
export function objectiveVisibilityAudience(mainTree, objectiveId) {
  const sharedOKRTs = Array.isArray(mainTree?.sharedOKRTs) ? mainTree.sharedOKRTs : [];
  if (!objectiveId || sharedOKRTs.length === 0) return [];

  const objectiveIdValue = String(objectiveId);
  const objective = sharedOKRTs.find((item) => String(item?.id) === objectiveIdValue);
  if (!objective) return [];

  const sharedGroups = objective.shared_groups || objective.sharedGroups || [];
  if (!Array.isArray(sharedGroups) || sharedGroups.length === 0) return [];

  const linkedGroupIds = new Set();
  sharedGroups.forEach((group) => {
    const name = group?.name;
    if (!name) return;
    const chain = objectiveGroupVisibilityChain(mainTree, name);
    chain.forEach((linked) => {
      if (linked?.id != null) linkedGroupIds.add(linked.id);
    });
  });

  if (linkedGroupIds.size === 0) return [];

  const groups = Array.isArray(mainTree?.groups) ? mainTree.groups : [];
  const membersById = new Map();

  groups.forEach((group) => {
    if (!group || !linkedGroupIds.has(group.id)) return;
    const members = Array.isArray(group.members) ? group.members : [];
    members.forEach((member) => {
      const memberId = member?.id;
      if (memberId == null || membersById.has(memberId)) return;
      membersById.set(memberId, {
        id: memberId,
        first_name: member?.first_name ?? null,
        last_name: member?.last_name ?? null
      });
    });
  });

  return Array.from(membersById.values());
}

// Gather an objective's ancestor and descendant OKR links.
export function objectiveFamilyLinks(mainTree, objectiveId) {
  const myOKRTs = Array.isArray(mainTree?.myOKRTs) ? mainTree.myOKRTs : [];
  const sharedOKRTs = Array.isArray(mainTree?.sharedOKRTs) ? mainTree.sharedOKRTs : [];
  const allOKRTs = myOKRTs.concat(sharedOKRTs);
  if (!objectiveId || allOKRTs.length === 0) return [];

  const byId = new Map();
  const childrenById = new Map();
  allOKRTs.forEach((item) => {
    if (!item || item.id == null) return;
    byId.set(item.id, item);
    const parentId = item.parent_id;
    if (parentId === null || parentId === undefined) return;
    if (!childrenById.has(parentId)) {
      childrenById.set(parentId, []);
    }
    childrenById.get(parentId).push(item.id);
  });

  const startId = String(objectiveId);
  const start = byId.get(objectiveId) || byId.get(startId);
  if (!start) return [];

  const linkedById = new Map();
  const pushLinked = (item) => {
    if (!item || item.id == null) return;
    if (linkedById.has(item.id)) return;
    linkedById.set(item.id, {
      id: item.id,
      title: item.title ?? '',
      owner_id: item.owner_id ?? null
    });
  };

  const addAncestors = (startItem) => {
    const chain = [];
    let current = startItem;
    const visited = new Set();
    while (current && current.id != null && !visited.has(current.id)) {
      visited.add(current.id);
      chain.push(current);
      const parentId = current.parent_id;
      current = parentId != null ? byId.get(parentId) : null;
    }
    chain.reverse().forEach(pushLinked);
  };

  const addDescendants = (startItem) => {
    const stack = [startItem.id];
    const visited = new Set();
    while (stack.length > 0) {
      const currentId = stack.pop();
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const current = byId.get(currentId);
      if (current) pushLinked(current);
      const children = childrenById.get(currentId) || [];
      for (let i = children.length - 1; i >= 0; i -= 1) {
        stack.push(children[i]);
      }
    }
  };

  addAncestors(start);
  addDescendants(start);

  return Array.from(linkedById.values());
}

// Normalize Jira keys for consistent matching.
const normalizeJiraKey = (value) => {
  if (!value) return '';
  return String(value).trim().toUpperCase();
};

// Recursively remove null/undefined values from arrays and objects.
const pruneNullishDeep = (value) => {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const next = value
      .map((item) => pruneNullishDeep(item))
      .filter((item) => item !== undefined);
    return next;
  }
  if (typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, child]) => {
      const pruned = pruneNullishDeep(child);
      if (pruned !== undefined) next[key] = pruned;
    });
    return next;
  }
  return value;
};

// Build a rich context block for an objective, including related entities.
export function buildObjectiveContextBlock(mainTree, objectiveId) {
  const myOKRTs = Array.isArray(mainTree?.myOKRTs) ? mainTree.myOKRTs : [];
  const sharedOKRTs = Array.isArray(mainTree?.sharedOKRTs) ? mainTree.sharedOKRTs : [];
  const initiatives = Array.isArray(mainTree?.initiatives) ? mainTree.initiatives : [];
  const allOKRTs = myOKRTs.concat(sharedOKRTs);
  if (!objectiveId || allOKRTs.length === 0) return null;

  const byId = new Map();
  allOKRTs.forEach((item) => {
    if (!item || item.id == null) return;
    byId.set(String(item.id), item);
  });

  const objective =
    byId.get(String(objectiveId)) ||
    byId.get(objectiveId);

  if (!objective || objective.type !== 'O') return null;

  const ancestors = [];
  const visited = new Set();
  let current = objective;
  while (current?.parent_id != null && !visited.has(String(current.parent_id))) {
    visited.add(String(current.parent_id));
    const parent = byId.get(String(current.parent_id));
    if (!parent || parent.type !== 'O') break;
    ancestors.unshift(parent);
    current = parent;
  }

  const childObjectives = allOKRTs.filter(
    (item) => item?.type === 'O' && String(item.parent_id) === String(objective.id)
  );

  const keyResults = allOKRTs.filter(
    (item) => item?.type === 'K' && String(item.parent_id) === String(objective.id)
  );
  const krIds = new Set(keyResults.map((kr) => String(kr.id)));

  const tasks = allOKRTs.filter(
    (item) => item?.type === 'T' && krIds.has(String(item.parent_id))
  );

  const jiraLinksRaw = objective?.jira_links || objective?.jiraLinks || [];
  const jiraLinks = new Set(
    (Array.isArray(jiraLinksRaw) ? jiraLinksRaw : [])
      .map(normalizeJiraKey)
      .filter(Boolean)
  );
  const linkedInitiatives = initiatives.filter((initiative) => {
    const key = normalizeJiraKey(initiative?.key);
    return key && jiraLinks.has(key);
  });

  const sharedGroupsRaw = objective?.shared_groups || objective?.sharedGroups || [];
  const sharedGroups = Array.isArray(sharedGroupsRaw)
    ? sharedGroupsRaw.filter(Boolean)
    : [];

  const payload = {
    objective,
    ancestors,
    childObjectives,
    keyResults,
    tasks,
    initiatives: linkedInitiatives,
    sharedGroups
  };

  return pruneNullishDeep(payload);
}

// Build a minimal context block with counts for an objective.
export function buildObjectiveMinimalContextBlock(mainTree, objectiveId) {
  const myOKRTs = Array.isArray(mainTree?.myOKRTs) ? mainTree.myOKRTs : [];
  const sharedOKRTs = Array.isArray(mainTree?.sharedOKRTs) ? mainTree.sharedOKRTs : [];
  const allOKRTs = myOKRTs.concat(sharedOKRTs);
  if (!objectiveId || allOKRTs.length === 0) return null;

  const objective = allOKRTs.find(
    (item) => item?.type === 'O' && String(item.id) === String(objectiveId)
  );
  if (!objective) return null;

  const childObjectives = allOKRTs.filter(
    (item) => item?.type === 'O' && String(item.parent_id) === String(objective.id)
  );
  const keyResults = allOKRTs.filter(
    (item) => item?.type === 'K' && String(item.parent_id) === String(objective.id)
  );
  const krIds = new Set(keyResults.map((kr) => String(kr.id)));
  const tasks = allOKRTs.filter(
    (item) => item?.type === 'T' && krIds.has(String(item.parent_id))
  );

  const jiraLinksRaw = objective?.jira_links || objective?.jiraLinks || [];
  const jiraLinks = new Set(
    (Array.isArray(jiraLinksRaw) ? jiraLinksRaw : [])
      .map(normalizeJiraKey)
      .filter(Boolean)
  );
  const initiatives = Array.isArray(mainTree?.initiatives) ? mainTree.initiatives : [];
  const linkedInitiatives = initiatives.filter((initiative) => {
    const key = normalizeJiraKey(initiative?.key);
    return key && jiraLinks.has(key);
  });

  return pruneNullishDeep({
    objective,
    counts: {
      childObjectives: childObjectives.length,
      initiatives: linkedInitiatives.length,
      keyResults: keyResults.length,
      tasks: tasks.length
    }
  });
}
