$p = 'C:\Users\张宏飞\Desktop\website_source\russian-learning-frontend-main\src\components\CourseContributeModal.jsx'
$c = [IO.File]::ReadAllText($p)

# 1) form 初始值
$old = @'
    grade: '',     // AI 自动打标：年级（投稿时 AI 生成，可改）
    textbook: '',  // AI 自动打标：教材版本（投稿时 AI 生成，可改）
  })
'@
$new = @'
    grade: '',     // AI 自动打标：年级（投稿时 AI 生成，可改）
    textbook: '',  // AI 自动打标：教材版本（投稿时 AI 生成，可改）
    isGrammar: false, // 显式标记：语法课程 → 答题积累「变格天赋树」六格数据
  })
'@
if ($c.Contains($old)) { $c = $c.Replace($old, $new); Write-Output "FORM OK" } else { Write-Output "FORM MISS" }

# 2) payload
$old2 = @'
        grade: form.grade || '',   // AI 自动打标：年级（游戏商城筛选/展示用）
        textbook: form.textbook || '', // AI 自动打标：教材版本
'@
$new2 = @'
        grade: form.grade || '',   // AI 自动打标：年级（游戏商城筛选/展示用）
        textbook: form.textbook || '', // AI 自动打标：教材版本
        isGrammar: !!form.isGrammar,    // 语法课程标记（通关之路天赋树数据源，学习页门控）
'@
if ($c.Contains($old2)) { $c = $c.Replace($old2, $new2); Write-Output "PAYLOAD OK" } else { Write-Output "PAYLOAD MISS" }

# 3) UI 开关（AI 自动打标区块之后、封面之前）
$old3 = @'
        <div className="field">
          <label>封面（可选，不选自动生成）</label>
'@
$new3 = @'
        <div className="field">
          <label>课程类型</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#333', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!form.isGrammar}
              onChange={e => setField('isGrammar', e.target.checked)}
            />
            <b>语法课程</b>
            <span className="hint" style={{ margin: 0 }}>勾选后，学习该课程的答题数据会点亮「通关之路 · 变格天赋树」（六格掌握度）；非语法课程不记六格</span>
          </label>
        </div>

        <div className="field">
          <label>封面（可选，不选自动生成）</label>
'@
if ($c.Contains($old3)) { $c = $c.Replace($old3, $new3); Write-Output "UI OK" } else { Write-Output "UI MISS" }

[IO.File]::WriteAllText($p, $c, (New-Object Text.UTF8Encoding $false))
Write-Output "MODAL DONE"
