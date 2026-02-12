export const getOwnerName = (okrt) => {
  if (okrt?.owner_name) return okrt.owner_name;
  if (okrt?.ownerName) return okrt.ownerName;
  const fullName = [okrt?.owner_first_name, okrt?.owner_last_name]
    .filter(Boolean)
    .join(' ');
  return fullName || okrt?.ownerName || 'Unknown owner';
};

export const getOwnerAvatar = (okrt) =>
  okrt?.owner_avatar || okrt?.ownerAvatar || okrt?.owner_profile_picture_url || '';

export const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '??';

export const getInitiativeCount = (okrt) => {
  const links = okrt?.jira_links || okrt?.jiraLinks || [];
  if (Array.isArray(links)) return links.length;
  return typeof links === 'string' && links ? 1 : 0;
};

export const getKpiCount = (okrt) => {
  if (Array.isArray(okrt?.kpis)) return okrt.kpis.length;
  if (Array.isArray(okrt?.kpi_list)) return okrt.kpi_list.length;
  if (Array.isArray(okrt?.kpiList)) return okrt.kpiList.length;
  if (typeof okrt?.kpi_count === 'number') return okrt.kpi_count;
  if (typeof okrt?.kpis_count === 'number') return okrt.kpis_count;
  if (typeof okrt?.kpiCount === 'number') return okrt.kpiCount;
  return 0;
};

export const getKrCount = (okrt) => {
  if (Array.isArray(okrt?.keyResults)) return okrt.keyResults.length;
  if (typeof okrt?.kr_count === 'number') return okrt.kr_count;
  if (typeof okrt?.keyResultsCount === 'number') return okrt.keyResultsCount;
  return 0;
};
