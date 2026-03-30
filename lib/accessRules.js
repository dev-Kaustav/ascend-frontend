function isPatternMatch(pattern, pathname) {
  if (!pattern || !pathname) return false;
  if (pattern.includes(":") || pattern.includes("*")) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const regexSource = escaped.replace(/:([^/]+)/g, "[^/]+").replace(/\*/g, ".*");
    const regex = new RegExp(`^${regexSource}$`);
    return regex.test(pathname);
  }
  return pathname === pattern || pathname.startsWith(`${pattern}/`);
}

export function normalizeAccessRules(rules = []) {
  return rules.map((rule) => ({
    ...rule,
    roles: Array.isArray(rule.roles) ? rule.roles : [],
    permissions: Array.isArray(rule.permissions) ? rule.permissions : []
  }));
}

export function getAccessRuleForPath(rules, pathname) {
  if (!pathname || !Array.isArray(rules)) return null;
  let matched = null;
  rules.forEach((rule) => {
    if (isPatternMatch(rule.path, pathname)) {
      if (!matched || rule.path.length > matched.path.length) {
        matched = rule;
      }
    }
  });
  return matched;
}
