
export type Person = {
  id: string;
  name: string;
  year?: string;
  skills?: string[];
  role?: string;
  discord?: string; // @username
};

export type Project = {
  id: string;
  name: string;
  owner_ids?: string[];
  design_link?: string;
  description?: string;
  due_date?: string;
  // Subsystem this project belongs to (e.g. "Aero", "Business", etc.)
  subsystem?: string;
};

export type Task = {
  id: string;
  project_id: string;
  description: string;
  status: "In Progress" | "Complete" | "Todo";
  assignee_id?: string; // Person.id of the assignee
};
