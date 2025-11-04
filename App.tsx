import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PayoutEntry } from './types';
import { generatePayoutsFromJson } from './services/geminiService';
import UploadIcon from './components/icons/UploadIcon';
import Spinner from './components/Spinner';

const APP_VERSION = "1.1.0";

const PayoutTable: React.FC<{ payouts: PayoutEntry[] }> = ({ payouts }) => {
  return (
    <div className="w-full max-h-60 overflow-y-auto rounded-lg border border-gray-700">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-700/50 sticky top-0">
          <tr>
            <th scope="col" className="px-6 py-3">Rank</th>
            <th scope="col" className="px-6 py-3">Prize</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => (
            <tr key={payout.position} className="border-b border-gray-700 hover:bg-gray-800/50">
              <td className="px-6 py-4 font-medium whitespace-nowrap">{payout.position}</td>
              <td className="px-6 py-4">{payout.prize.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const JsonDisplay: React.FC<{ json: string }> = ({ json }) => {
    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(json);
    }, [json]);

    return (
        <div className="relative w-full">
            <pre className="bg-gray-800 p-4 rounded-lg text-sm text-green-300 overflow-x-auto max-h-60">
                <code>{json}</code>
            </pre>
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded text-white transition-colors"
            >
                Copy
            </button>
        </div>
    );
};

const App: React.FC = () => {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [payouts, setPayouts] = useState<PayoutEntry[] | null>(null);
  const [hrcJson, setHrcJson] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const filesArray = Array.from(newFiles);
    const newImageUrls = filesArray.map(file => URL.createObjectURL(file));
    
    setImageFiles(prev => [...prev, ...filesArray]);
    setImageUrls(prev => [...prev, ...newImageUrls]);
    
    setPayouts(null);
    setHrcJson(null);
    setError(null);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(event.target.files);
      event.target.value = ''; // Reset input to allow re-uploading the same file
    }
  };
  
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            addFiles([file]);
            event.preventDefault();
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [addFiles]);

  const handleGenerateJson = async () => {
    if (imageFiles.length === 0) {
      setError("Please upload at least one image first.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPayouts(null);
    setHrcJson(null);

    try {
      const extractedPayouts = await generatePayoutsFromJson(imageFiles);
      // Sort payouts by position just in case the AI doesn't return them in order
      extractedPayouts.sort((a, b) => a.position - b.position);
      setPayouts(extractedPayouts);

      const tournamentEntry = extractedPayouts.map(p => ({
        "@position": String(p.position),
        "@prize": p.prize.toFixed(2),
      }));

      const hrcJsonData = {
        "CompletedTournament": {
            "@name": "Custom Tournament Payouts",
            "@stake": "0",
            "@rake": "0",
            "@currency": "USD",
            "TournamentEntry": tournamentEntry
        }
      };

      setHrcJson(JSON.stringify(hrcJsonData, null, 2));
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadJson = () => {
    if (!hrcJson) return;
    const blob = new Blob([hrcJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hrc_payouts.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    imageUrls.forEach(url => URL.revokeObjectURL(url));
    setImageFiles([]);
    setImageUrls([]);
    setPayouts(null);
    setHrcJson(null);
    setError(null);
    setIsLoading(false);
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            Poker Payout Converter
          </h1>
          <p className="text-gray-400 mt-2">
            Upload payout screenshots to generate a JSON file for Holdem Resources Calculator.
          </p>
        </header>

        <main className="space-y-6">
          <div
            className="w-full min-h-64 border-2 border-dashed border-gray-600 rounded-lg flex flex-col justify-center items-center cursor-pointer hover:border-indigo-500 hover:bg-gray-800/50 transition-colors"
            onClick={imageFiles.length === 0 ? triggerFileSelect : undefined}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) {
                addFiles(e.dataTransfer.files);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
              multiple
            />
            {imageUrls.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 p-4 w-full">
                    {imageUrls.map((url, index) => (
                      <div key={index} className="aspect-w-1 aspect-h-1">
                        <img src={url} alt={`Payout preview ${index + 1}`} className="object-contain w-full h-full rounded-md bg-black/20" />
                      </div>
                    ))}
                </div>
            ) : (
              <div className="text-center text-gray-500 pointer-events-none p-4">
                <UploadIcon className="mx-auto h-12 w-12" />
                <p className="mt-2">Click to upload, drag & drop, or paste images</p>
                <p className="text-xs">PNG, JPG, WEBP, etc.</p>
              </div>
            )}
          </div>

          {imageFiles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                onClick={handleReset}
                className="w-full flex justify-center items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                  Reset
              </button>
              <button
                onClick={handleGenerateJson}
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                {isLoading ? <><Spinner/> Processing Images...</> : 'Generate HRC JSON'}
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {payouts && hrcJson && (
            <div className="space-y-6 bg-gray-800/40 p-6 rounded-lg">
                <h2 className="text-xl font-semibold">Extracted Payouts ({payouts.length})</h2>
                <PayoutTable payouts={payouts} />
                <h2 className="text-xl font-semibold mt-4">HRC Compatible JSON</h2>
                <JsonDisplay json={hrcJson} />
                <button
                    onClick={handleDownloadJson}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                    Download .json File
                </button>
            </div>
          )}
        </main>
        
        <footer className="text-center mt-8 text-sm text-gray-500">
            <p>Version: {APP_VERSION}</p>
        </footer>
      </div>
    </div>
  );
};

export default App;