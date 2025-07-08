import React, { useState, useRef, useEffect } from 'react';
import { Upload, PieChart, Calculator, TrendingUp, Book, Wallet, Coffee, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// Claude API 相关常量
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_ATTACHMENT_URL = 'https://api.anthropic.com/v1/attachments';

// 读取 Netlify 环境变量
const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

const ExpenseAnalyzer = () => {
  // 用户状态管理  
  const [user, setUser] = useState({ username: '用户' });
  
  // 基本信息状态
  const [basicInfo, setBasicInfo] = useState({
    salary: '',
    currentMonth: new Date().toISOString().slice(0, 7),
    yearlyTravel: ''
  });

  // 手动输入的费用状态
  const [manualExpenses, setManualExpenses] = useState({
    food: '', entertainment: '', shopping: '', transportation: '', utilities: '', phone: '', household: '', others_expense: '',
    books: '', courses: '', training: '', certification: '',
    epf: '', stocks: '', fixedDeposit: '', insurance: '', emergencyFund: '', others_savings: ''
  });
  
  // 账单和分析状态
  const [uploadedBills, setUploadedBills] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  // 删除 claudeApiKey 状态
  
  // UI状态
  const [activeTab, setActiveTab] = useState('basic');
  const [inputMethod, setInputMethod] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const fileInputRef = useRef(null);

  // 日历相关函数
  const getCurrentYear = () => new Date().getFullYear();
  const getCurrentMonth = () => new Date().getMonth();
  
  const [calendarYear, setCalendarYear] = useState(getCurrentYear());
  const [calendarMonth, setCalendarMonth] = useState(getCurrentMonth());

  const months = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  const formatMonthValue = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;
  const parseMonthValue = (value) => { const [year, month] = value.split('-'); return { year: parseInt(year), month: parseInt(month) - 1 }; };
  const selectMonth = (year, month) => {
    const monthValue = formatMonthValue(year, month);
    setBasicInfo({...basicInfo, currentMonth: monthValue});
    setCalendarYear(year);
    setCalendarMonth(month);
    setShowCalendar(false);
  };

  useEffect(() => {
    const { year, month } = parseMonthValue(basicInfo.currentMonth);
    setCalendarYear(year);
    setCalendarMonth(month);
  }, [basicInfo.currentMonth]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && activeTab === 'details' && inputMethod === 'manual') {
        analyzeManualExpenses();
      }
      if (e.key === 'Escape' && showCalendar) {
        setShowCalendar(false);
      }
    };
    const handleClickOutside = (e) => {
      if (showCalendar && !e.target.closest('.calendar-container')) {
        setShowCalendar(false);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    document.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeTab, inputMethod, showCalendar]);

  // 文件上传处理 - 使用 Claude API
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const billEntry = {
        id: Date.now() + Math.random(),
        file: file,
        fileName: file.name,
        extractedData: null,
        uploadTime: new Date().toLocaleString(),
        status: 'processing'
      };
      setUploadedBills(prev => [...prev, billEntry]);
      try {
        const claudeResult = await analyzeWithClaude(file);
        setUploadedBills(prev => prev.map(bill => 
          bill.id === billEntry.id 
            ? { ...bill, extractedData: claudeResult, status: 'completed' }
            : bill
        ));
      } catch (error) {
        setUploadedBills(prev => prev.map(bill => 
          bill.id === billEntry.id 
            ? { ...bill, status: 'error', error: error.message }
            : bill
        ));
      }
    }
  };

  // 使用 Claude API 分析账单（支持图片和 PDF）
  const analyzeWithClaude = async (file) => {
    if (!CLAUDE_API_KEY) throw new Error('请在 Netlify 环境变量中设置 VITE_CLAUDE_API_KEY');
    // 1. 上传文件到 Claude，获取 attachment id
    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch(CLAUDE_ATTACHMENT_URL, {
      method: 'POST',
      headers: { 'x-api-key': CLAUDE_API_KEY },
      body: formData
    });
    if (!uploadRes.ok) throw new Error('PDF/图片上传失败: ' + (await uploadRes.text()));
    const uploadData = await uploadRes.json();
    const fileId = uploadData.attachment?.id || uploadData.id;
    if (!fileId) throw new Error('未获取到文件ID');
    // 2. 调用 Claude API 进行分析
    const prompt = `请分析这个账单（图片或PDF），提取以下信息并以JSON格式返回：\n{\n  "vendor": "商家名称",\n  "amount": "金额数字（只要数字，不要货币符号）",\n  "date": "日期（YYYY-MM-DD格式）",\n  "category": "类别（从以下选择：开销、学习、储蓄）",\n  "items": ["具体购买的项目列表"]\n}\n分类规则：\n- 开销：餐饮、娱乐、购物、交通、水电、手机、家用等日常消费\n- 学习：书籍、课程、培训、旅游、教育相关支出\n- 储蓄：EPF、投资、保险、定存等储蓄投资\n请确保返回有效的JSON格式。`;
    const body = {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'attachment', attachment: { id: fileId, type: file.type } }
        ] }
      ]
    };
    const res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Claude API 错误: ' + (await res.text()));
    const data = await res.json();
    // Claude 返回内容可能带有代码块格式，需清理
    let text = data?.content?.[0]?.text || JSON.stringify(data, null, 2);
    text = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('无法解析 Claude 返回的账单信息: ' + text);
    }
  };

  // 重试分析功能
  const retryAnalysis = async (bill) => {
    setUploadedBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: 'processing', error: null } : b));
    try {
      const claudeResult = await analyzeWithClaude(bill.file);
      setUploadedBills(prev => prev.map(b => b.id === bill.id ? { ...b, extractedData: claudeResult, status: 'completed' } : b));
    } catch (error) {
      setUploadedBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: 'error', error: error.message } : b));
    }
  };

  // 处理 API Key 输入
  // 删除 handleApiKeyChange 函数

  // 分析手动输入的费用
  const analyzeManualExpenses = () => {
    const expenses = Object.entries(manualExpenses).map(([key, value]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: parseFloat(value) || 0
    }));
    setAnalysisResult({
      totalExpenses: expenses.reduce((sum, item) => sum + item.value, 0),
      categories: expenses.reduce((acc, item) => {
        const category = item.name.toLowerCase().replace(/\s/g, '');
        if (category in acc) {
          acc[category] += item.value;
        } else {
          acc[category] = item.value;
        }
        return acc;
      }, {})
    });
  };

  // 计算总收入
  const calculateTotalIncome = () => {
    const salary = parseFloat(basicInfo.salary) || 0;
    const yearlyTravel = parseFloat(basicInfo.yearlyTravel) || 0;
    return salary + yearlyTravel;
  };

  // 计算总支出
  const calculateTotalExpenses = () => {
    const uploadedExpenses = uploadedBills.map(bill => bill.extractedData?.amount || 0).reduce((sum, val) => sum + val, 0);
    const manualExpensesSum = Object.values(manualExpenses).reduce((sum, val) => sum + parseFloat(val) || 0, 0);
    return uploadedExpenses + manualExpensesSum;
  };

  // 计算结余
  const calculateSurplus = () => {
    const totalIncome = calculateTotalIncome();
    const totalExpenses = calculateTotalExpenses();
    return totalIncome - totalExpenses;
  };

  // 计算各类别占比
  const calculateCategoryRatio = () => {
    const totalExpenses = calculateTotalExpenses();
    if (totalExpenses === 0) return {};
    return Object.entries(analysisResult?.categories || {}).map(([name, value]) => ({
      name,
      value: (value / totalExpenses) * 100
    }));
  };

  // 处理日期选择
  const handleDateChange = (e) => {
    setBasicInfo({ ...basicInfo, [e.target.name]: e.target.value });
  };

  // 处理手动输入费用
  const handleManualExpenseChange = (e) => {
    setManualExpenses({ ...manualExpenses, [e.target.name]: e.target.value });
  };

  // 处理基本信息保存
  const handleBasicInfoSave = () => {
    // 实际保存逻辑
    console.log('保存基本信息:', basicInfo);
    alert('基本信息已保存！');
  };

  // 处理手动输入费用保存
  const handleManualExpensesSave = () => {
    // 实际保存逻辑
    console.log('保存手动输入费用:', manualExpenses);
    alert('手动输入费用已保存！');
  };

  // 处理账单上传保存
  const handleBillsSave = () => {
    // 实际保存逻辑
    console.log('保存账单:', uploadedBills);
    alert('账单已保存！');
  };

  // 处理分析结果保存
  const handleAnalysisResultSave = () => {
    // 实际保存逻辑
    console.log('保存分析结果:', analysisResult);
    alert('分析结果已保存！');
  };

  // 下面是完整多标签页 UI
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white shadow-lg border-b sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 flex items-center justify-center py-5">
          <span className="flex items-center gap-3">
            <Calculator className="h-8 w-8 text-indigo-600" />
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">财务账单分析系统</h1>
          </span>
        </div>
      </div>
      {/* 主内容区域 */}
      <div className="max-w-2xl mx-auto px-2 sm:px-6 lg:px-8 py-10">
        {/* 进度指示器 */}
        <div className="mb-10 sticky top-20 z-20 bg-gray-50/80 backdrop-blur rounded-xl shadow-sm py-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center w-full max-w-xl">
              {/* 步骤1 */}
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-200 border-2 ${
                  activeTab === 'basic' ? 'bg-indigo-600 text-white shadow-lg scale-110 border-indigo-600' : 
                  activeTab === 'details' || activeTab === 'analysis' ? 'bg-green-500 text-white border-green-500' : 
                  'bg-gray-200 text-gray-600 border-gray-300'
                }`}>
                  1
                </div>
                <span className={`mt-2 text-base font-semibold ${
                  activeTab === 'basic' ? 'text-indigo-600' : 
                  activeTab === 'details' || activeTab === 'analysis' ? 'text-green-600' : 
                  'text-gray-400'
                }`}>
                  基本信息
                </span>
              </div>
              {/* 连接线 */}
              <div className={`h-1 flex-1 mx-2 rounded-full ${
                activeTab === 'details' || activeTab === 'analysis' ? 'bg-green-400' : 'bg-gray-200'
              }`}></div>
              {/* 步骤2 */}
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-200 border-2 ${
                  activeTab === 'details' ? 'bg-indigo-600 text-white shadow-lg scale-110 border-indigo-600' : 
                  activeTab === 'analysis' ? 'bg-green-500 text-white border-green-500' : 
                  'bg-gray-200 text-gray-600 border-gray-300'
                }`}>
                  2
                </div>
                <span className={`mt-2 text-base font-semibold ${
                  activeTab === 'details' ? 'text-indigo-600' : 
                  activeTab === 'analysis' ? 'text-green-600' : 
                  'text-gray-400'
                }`}>
                  财务细节
                </span>
              </div>
              {/* 连接线 */}
              <div className={`h-1 flex-1 mx-2 rounded-full ${
                activeTab === 'analysis' ? 'bg-green-400' : 'bg-gray-200'
              }`}></div>
              {/* 步骤3 */}
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-200 border-2 ${
                  activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-lg scale-110 border-indigo-600' : 'bg-gray-200 text-gray-600 border-gray-300'
                }`}>
                  3
                </div>
                <span className={`mt-2 text-base font-semibold ${
                  activeTab === 'analysis' ? 'text-indigo-600' : 'text-gray-400'
                }`}>
                  分析结果
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* 主内容区优化 ... 其余内容区、表单、上传、分析结果等全部加大圆角、间距、卡片化、按钮美化、输入框美化、hover、空态、错误提示等 ... */}
        {activeTab === 'basic' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">基本财务信息</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">月薪 (RM)</label>
                <input
                  type="number"
                  value={basicInfo.salary}
                  onChange={e => setBasicInfo({...basicInfo, salary: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="请输入每月薪水"
                />
              </div>
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">分析月份</label>
                <div className="relative calendar-container">
                  <button
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-left flex items-center justify-between bg-white hover:bg-gray-50"
                  >
                    <span className="flex items-center">
                      <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                      {(() => {
                        const { year, month } = parseMonthValue(basicInfo.currentMonth);
                        return `${year}年 ${months[month]}`;
                      })()}
                    </span>
                    <ChevronRight className={`h-5 w-5 text-gray-400 transform transition-transform ${showCalendar ? 'rotate-90' : ''}`} />
                  </button>
                  {showCalendar && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <button onClick={() => {
                          if (calendarMonth === 0) {
                            setCalendarYear(calendarYear - 1);
                            setCalendarMonth(11);
                          } else {
                            setCalendarMonth(calendarMonth - 1);
                          }
                        }} className="p-1 hover:bg-gray-100 rounded">
                          <ChevronLeft className="h-5 w-5 text-gray-600" />
                        </button>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-gray-900">{calendarYear}年</div>
                          <div className="text-sm text-gray-600">{months[calendarMonth]}</div>
                        </div>
                        <button onClick={() => {
                          if (calendarMonth === 11) {
                            setCalendarYear(calendarYear + 1);
                            setCalendarMonth(0);
                          } else {
                            setCalendarMonth(calendarMonth + 1);
                          }
                        }} className="p-1 hover:bg-gray-100 rounded">
                          <ChevronRight className="h-5 w-5 text-gray-600" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {months.map((month, index) => {
                          const isSelected = calendarYear === parseMonthValue(basicInfo.currentMonth).year && index === parseMonthValue(basicInfo.currentMonth).month;
                          const isCurrent = calendarYear === getCurrentYear() && index === getCurrentMonth();
                          return (
                            <button key={month} onClick={() => selectMonth(calendarYear, index)} className={`px-3 py-2 text-sm rounded-lg border transition-colors ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : isCurrent ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>{month}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">旅游预算 (RM/年)</label>
                <input
                  type="number"
                  value={basicInfo.yearlyTravel}
                  onChange={e => setBasicInfo({...basicInfo, yearlyTravel: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="每年旅游预算 (将自动分摊到学习类)"
                />
                <p className="text-sm text-gray-500 mt-1">年预算将除以12计入每月学习类别</p>
              </div>
            </div>
            <div className="mt-8 text-center">
              <button
                onClick={() => setActiveTab('details')}
                disabled={!basicInfo.salary}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步 →
              </button>
            </div>
          </div>
        )}
        {activeTab === 'details' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">财务细节</h2>
            <div className="mb-4">
              <button onClick={() => setInputMethod('upload')} className="mr-4 bg-indigo-100 px-4 py-2 rounded-lg hover:bg-indigo-200 transition-colors">上传账单</button>
              <button onClick={() => setInputMethod('manual')} className="bg-green-100 px-4 py-2 rounded-lg hover:bg-green-200 transition-colors">手动填入</button>
            </div>
            {inputMethod === 'upload' && (
              <div>
                <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileUpload} className="mb-4" />
                <div>
                  {uploadedBills.map(bill => (
                    <div key={bill.id} className="border p-2 mb-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <span className="text-base font-medium">{bill.fileName}</span>
                      <span className="ml-2 text-xs text-gray-600">{bill.status}</span>
                      {bill.status === 'error' && <span className="text-red-600 ml-2 text-sm">{bill.error}</span>}
                      {bill.status === 'completed' && bill.extractedData && (
                        <div className="text-xs mt-1 text-gray-700">{JSON.stringify(bill.extractedData)}</div>
                      )}
                      {bill.status === 'error' && <button className="ml-2 text-xs text-blue-600 hover:underline" onClick={() => retryAnalysis(bill)}>重试</button>}
                    </div>
                  ))}
                </div>
                <button onClick={() => setActiveTab('analysis')} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">分析账单</button>
              </div>
            )}
            {inputMethod === 'manual' && (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input type="number" placeholder="餐饮费" value={manualExpenses.food} onChange={e => setManualExpenses({...manualExpenses, food: e.target.value})} className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  <input type="number" placeholder="娱乐费" value={manualExpenses.entertainment} onChange={e => setManualExpenses({...manualExpenses, entertainment: e.target.value})} className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  <input type="number" placeholder="购物费" value={manualExpenses.shopping} onChange={e => setManualExpenses({...manualExpenses, shopping: e.target.value})} className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  <input type="number" placeholder="交通费" value={manualExpenses.transportation} onChange={e => setManualExpenses({...manualExpenses, transportation: e.target.value})} className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  <input type="number" placeholder="水电费" value={manualExpenses.utilities} onChange={e => setManualExpenses({...manualExpenses, utilities: e.target.value})} className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  <input type="number" placeholder="手机费" value={manualExpenses.phone} onChange={e => setManualExpenses({...manualExpenses, phone: e.target.value})} className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  <input type="number" placeholder="家用" value={manualExpenses.household} onChange={e => setManualExpenses({...manualExpenses, household: e.target.value})} className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  <input type="number" placeholder="其他开销" value={manualExpenses.others_expense} onChange={e => setManualExpenses({...manualExpenses, others_expense: e.target.value})} className="border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
                <button onClick={analyzeManualExpenses} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">分析手动数据</button>
              </div>
            )}
          </div>
        )}
        {activeTab === 'analysis' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">分析结果</h2>
            {analysisResult ? (
              <pre className="bg-gray-100 p-3 rounded-lg text-sm overflow-x-auto max-h-96 text-gray-800">{JSON.stringify(analysisResult, null, 2)}</pre>
            ) : (
              <div className="text-center py-10 text-gray-500">暂无分析结果</div>
            )}
            <button onClick={() => setActiveTab('basic')} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors">重新开始</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseAnalyzer; 