'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Send, CheckCircle, AlertCircle, Mail } from 'lucide-react';

export default function DeliveryPage() {
  const [file, setFile] = useState<File | null>(null);
  const [email, setEmail] = useState<string>('bkluce@icloud.com');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('email', email);

    try {
      const response = await fetch('/api/delivery/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccess(true);
      setFile(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
       <div className="mb-8">
         <h1 className="text-3xl font-bold text-white">Delivery Contracts</h1>
         <p className="mt-2 text-gray-400">Upload CSV contracts for automated processing and delivery.</p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#1e293b] p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-300">
              Email Recipient
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-700 bg-gray-800 p-2.5 pl-10 text-sm text-white placeholder-gray-400 focus:border-[#003366] focus:ring-[#003366]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="file" className="mb-2 block text-sm font-medium text-gray-300">
              Upload CSV File
            </label>
             <div className="relative">
                <input
                  id="file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="file"
                  className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 bg-gray-800 p-8 hover:border-[#003366] hover:bg-gray-700 transition-colors"
                >
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <span className="text-sm text-gray-300">
                    {file ? file.name : 'Click to upload CSV'}
                  </span>
                   <span className="mt-1 text-xs text-gray-500">CSV files only</span>
                </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="flex w-full items-center justify-center rounded-lg bg-[#003366] px-5 py-3 text-sm font-medium text-white hover:bg-[#004080] focus:outline-none focus:ring-4 focus:ring-[#003366]/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          >
             {uploading ? (
                <>Processing...</>
            ) : (
                <>
                    <Send className="mr-2 h-5 w-5" />
                    Submit Contract
                </>
            )}
          </button>
        </form>
      </div>

      {success && (
        <div className="mt-6 flex items-center rounded-lg border border-green-800 bg-green-900/30 p-4 text-green-400">
          <CheckCircle className="mr-3 h-5 w-5 flex-shrink-0" />
          <span>Success! Check your email for the processed report.</span>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-center rounded-lg border border-red-800 bg-red-900/30 p-4 text-red-400">
           <AlertCircle className="mr-3 h-5 w-5 flex-shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}
    </div>
  );
}
