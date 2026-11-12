import { useEffect, useState } from 'react';
import { getQuestionEnginePluginStatus } from '../../lib/api-admin';
import { AdminPanel, AdminPanelHeader } from './AdminWorkbench';

export function FormalQuestionEnginesPanel() {
  const [state, setState] = useState('正在读取插件状态…');
  useEffect(() => {
    let alive = true;
    void getQuestionEnginePluginStatus().then(status => {
      const math = status.plugins.find(plugin => plugin.descriptor.id === 'verified-math-1.43');
      if (alive) setState(math?.generationWritesEnabled ? '已启用 · 生成、核验与发布后供题' : '未启用或尚未就绪 · 现有题库继续可用');
    }).catch(() => { if (alive) setState('暂时无法读取状态 · 现有题库继续可用'); });
    return () => { alive = false; };
  }, []);
  return <AdminPanel data-testid="formal-question-engines">
    <AdminPanelHeader kicker="正式出题插件" title="数学 1.43" />
    <p role="status">{state}</p>
    <p>学生从原有自由练习入口选择知识点和难度。库存不足时，由数学插件补题，核验、去重并发布后进入练习。</p>
    <table><thead><tr><th>科目</th><th>现有题库与做题</th><th>正式出题引擎</th></tr></thead><tbody>
      <tr><td>数学</td><td>保留</td><td>1.43</td></tr>
      <tr><td>物理</td><td>保留</td><td>尚未接入</td></tr>
      <tr><td>化学</td><td>保留</td><td>尚未接入</td></tr>
    </tbody></table>
    <p>旧生成器、旧自动生产及模考生成入口已停用。已有题目和历史作答记录继续保留。</p>
  </AdminPanel>;
}
