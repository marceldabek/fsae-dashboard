
export type Person = {
  id: string;
  name: string;
  year?: string;
  skills?: string[];
  role?: string;
};

export type Project = {
  id: string;
  name: string;
  owner_ids?: string[];
  design_link?: string;
  description?: string;
  due_date?: string;
};

export type Task = {
  id: string;
  project_id: string;
  description: string;
  status: "In Progress" | "Complete" | "Todo";
};
