// Ascend Foods demo palette — JS constants for charts and inline styles.
export const ascend = {
  carbon: '#0b0d0c',
  graphite: '#171b18',
  ink: '#151714',
  cream: '#f4f1e8',
  paper: '#ebe7dc',
  warmWhite: '#fffdf8',
  lime: '#c8ff3d',
  limeDark: '#6e8e17',
  limeWash: '#eef3d8',
  orange: '#E97132',
  muted: '#60655f',
  metal: '#9da49e',
  riskHigh: '#c0341d',
  riskMedium: '#E97132',
  riskLow: '#4e7d3e',
};

export const chartColors = [ascend.limeDark, ascend.carbon, ascend.orange, '#4e7d3e', ascend.metal];

export const riskMeta = {
  high: { color: ascend.riskHigh, bg: 'rgba(192,52,29,0.10)', label: 'Likely replenishment due' },
  medium: { color: ascend.orange, bg: 'rgba(233,113,50,0.12)', label: 'Reorder window approaching' },
  low: { color: ascend.riskLow, bg: 'rgba(78,125,62,0.12)', label: 'On cycle' },
};
