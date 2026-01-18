// Minimal toast shim used by EmailManager while we don't install react-hot-toast
let _id = 0;

const toast = {
  loading: (msg: string) => {
    const id = ++_id;
    // For now just log; apps can be updated to use a proper toast library
    console.log(`[toast:${id}] loading:`, msg);
    return id;
  },
  success: (msg: string, opts?: { id?: number } | undefined) => {
    console.log('[toast] success:', msg, opts || '');
  },
  error: (msg: string, opts?: { id?: number } | undefined) => {
    console.error('[toast] error:', msg, opts || '');
  }
};

export default toast;
