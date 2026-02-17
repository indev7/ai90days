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
