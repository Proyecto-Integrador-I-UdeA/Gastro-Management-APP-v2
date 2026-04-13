import toast from "react-hot-toast";

export const showError = (msg: string) => {
  toast.error(msg);
};

export const showSuccess = (msg: string) => {
  toast.success(msg);
};

export const showLoading = (msg: string) => {
  return toast.loading(msg);
};
