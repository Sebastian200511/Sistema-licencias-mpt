import { AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function Alert({ type = 'info', message }) {
  if (!message) return null;

  const styles = {
    error: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200'
  };

  const icons = {
    error: <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />,
    success: <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />,
    info: <Info className="w-5 h-5 mr-2 flex-shrink-0" />
  };

  return (
    <div className={`p-4 rounded-lg border flex items-center mb-6 animate-fade-in ${styles[type]}`}>
      {icons[type]}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
