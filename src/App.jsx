import React, { useState } from 'react';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 处理 PDF 文件选择
  const handleFileChange = (e) => {
    setPdfFile(e.target.files[0] || null);
    setResult('');
    setError('');
  };

  // 处理 API Key 输入
  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value);
  };

  // 上传 PDF 并调用 Claude API
  const handleAnalyze = async () => {
    if (!apiKey) {
      setError('请先输入 Claude API Key');
      return;
    }
    if (!pdfFile) {
      setError('请先选择 PDF 文件');
      return;
    }
    setLoading(true);
    setResult('');
    setError('');
    try {
      // 1. 先上传 PDF 文件到 Claude，获取 file_id
      const formData = new FormData();
      formData.append('file', pdfFile);
      const uploadRes = await fetch('https://api.anthropic.com/v1/attachments', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey
        },
        body: formData
      });
      if (!uploadRes.ok) {
        throw new Error('PDF 上传失败: ' + (await uploadRes.text()));
      }
      const uploadData = await uploadRes.json();
      const fileId = uploadData.attachment?.id || uploadData.id;
      if (!fileId) throw new Error('未获取到文件ID');

      // 2. 调用 Claude API 进行分析
      const prompt = `请分析这个 PDF 账单，提取每一笔消费的商家、金额、日期、类别（如餐饮、购物、储蓄等），并以 JSON 数组返回。`;
      const body = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4096,
        messages: [
          { role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'attachment', attachment: { id: fileId, type: 'application/pdf' } }
          ] }
        ]
      };
      const res = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        throw new Error('Claude API 错误: ' + (await res.text()));
      }
      const data = await res.json();
      setResult(data?.content?.[0]?.text || JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white shadow rounded-lg p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Claude PDF 账单分析器</h1>
        <div className="mb-4">
          <label className="block mb-1 font-medium">Claude API Key</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            placeholder="请输入 Claude API Key"
            value={apiKey}
            onChange={handleApiKeyChange}
            autoComplete="off"
          />
        </div>
        <div className="mb-4">
          <label className="block mb-1 font-medium">上传 PDF 账单</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="w-full"
          />
        </div>
        <button
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? '分析中...' : '开始分析'}
        </button>
        {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
        {result && (
          <div className="mt-6">
            <h2 className="font-semibold mb-2">分析结果：</h2>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto max-h-96">{result}</pre>
          </div>
        )}
      </div>
      <footer className="mt-8 text-gray-400 text-xs">&copy; {new Date().getFullYear()} Claude PDF 账单分析器</footer>
    </div>
  );
} 