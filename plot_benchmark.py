"""Plot benchmark results from results/benchmark.csv."""

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

df = pd.read_csv('results/benchmark.csv')
df = df[df['error'].isna() | (df['error'] == '')]  # drop failed runs

# ── Fig 1: Latency comparison ────────────────────────────────────────────────

fig, axes = plt.subplots(1, 2, figsize=(12, 5))

# Average latency per approach
grp = df.groupby('approach')['latency_s']
avg, std = grp.mean(), grp.std()
colors = {'Claude': '#6366f1', 'Reducto': '#f97316'}
bar_colors = [colors.get(a, '#999') for a in avg.index]
avg.plot.bar(ax=axes[0], yerr=std, capsize=4, color=bar_colors)
axes[0].set_title('Mean Latency (s)')
axes[0].set_ylabel('Seconds')
axes[0].tick_params(axis='x', rotation=0)
for i, (v, s) in enumerate(zip(avg, std)):
    axes[0].text(i, v + s + 1, f'{v:.1f}±{s:.1f}s', ha='center', fontweight='bold')

# Average passages per approach
grp_p = df.groupby('approach')['num_passages']
avg_p, std_p = grp_p.mean(), grp_p.std()
avg_p.plot.bar(ax=axes[1], yerr=std_p, capsize=4, color=bar_colors)
axes[1].set_title('Mean Passages Returned')
axes[1].set_ylabel('Count')
axes[1].tick_params(axis='x', rotation=0)
for i, (v, s) in enumerate(zip(avg_p, std_p)):
    axes[1].text(i, v + s + 0.3, f'{v:.1f}±{s:.1f}', ha='center', fontweight='bold')

plt.tight_layout()
plt.savefig('results/benchmark_summary.png', dpi=150)
print('Saved results/benchmark_summary.png')

# ── Fig 2: Latency by PDF ────────────────────────────────────────────────────

pivot_mean = df.pivot_table(index='pdf', columns='approach', values='latency_s', aggfunc='mean')
pivot_std = df.pivot_table(index='pdf', columns='approach', values='latency_s', aggfunc='std')
ax = pivot_mean.plot.bar(yerr=pivot_std, capsize=3, figsize=(10, 5), color=[colors.get(c, '#999') for c in pivot_mean.columns])
ax.set_title('Mean Latency by Paper')
ax.set_ylabel('Seconds')
ax.tick_params(axis='x', rotation=30)
plt.legend(title='Approach')
plt.tight_layout()
plt.savefig('results/benchmark_by_pdf.png', dpi=150)
print('Saved results/benchmark_by_pdf.png')

plt.show()
