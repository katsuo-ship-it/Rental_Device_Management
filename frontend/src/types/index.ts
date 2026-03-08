export type DeviceStatus = 'in_stock' | 'renting' | 'sold';
export type DeviceType = 'smartphone' | 'accessory';
export type ContractStatus = 'active' | 'returned' | 'cancelled';

export interface Device {
  id: number;
  management_no: string;
  device_type: DeviceType;
  model_name: string;
  color: string;
  capacity: string;
  imei: string;
  carrier_sb: boolean;
  carrier_au: boolean;
  carrier_his: boolean;
  carrier_rakuten: boolean;
  condition_notes: string;
  status: DeviceStatus;
  check_appearance: string;
  check_boot: string;
  check_sim: string;
  check_charge: string;
  check_battery: number;
  purchase_price: number;
  supplier: string;
  purchase_date: string;
  arrival_date: string;
  wholesale_price: number;
  // JOIN from rental_contracts
  contract_id?: number;
  customer_name?: string;
  contract_start_date?: string;
  contract_end_date?: string;
  monthly_end_user_price?: number;
  monthly_wholesale_price?: number;
  total_repair_cost?: number;
  created_at: string;
  updated_at: string;
}

export interface RentalContract {
  id: number;
  device_id: number;
  customer_dataverse_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_name: string;
  delivery_address: string;
  delivery_phone: string;
  contract_start_date: string;
  billing_start_date: string;
  contract_end_date: string;
  contract_months: number;
  auto_renewal: boolean;
  min_contract_months: number;
  total_contract_months: number;
  monthly_wholesale_price: number;
  monthly_end_user_price: number;
  natural_failure_coverage: boolean;
  op_coverage: boolean;
  op_coverage_details: string;
  op_coverage_price: number;
  status: ContractStatus;
  notes: string;
  // JOIN from devices
  model_name?: string;
  color?: string;
  capacity?: string;
  management_no?: string;
  device_type?: DeviceType;
  // computed
  days_until_end?: number;
  total_repair_cost?: number;
}

export interface DataverseCustomer {
  accountid: string;
  name: string;
  telephone1: string;
  address1_city: string;
  address1_line1: string;
}

export interface MonthlySummary {
  rental_revenue: number;
  rental_profit: number;
  sale_revenue: number;
  sale_profit: number;
  total_revenue: number;
  total_profit: number;
  repair_cost: number;
  active_contracts: number;
}

export interface DashboardSummary {
  devices: {
    in_stock: number;
    renting: number;
    sold: number;
    total: number;
  };
  current_month: {
    monthly_revenue: number;
    monthly_profit: number;
    active_contracts: number;
  };
}

export interface YearlyReportMonth {
  month: number;
  active_contracts: number;
  rental_revenue: number;
  rental_profit: number;
  sale_revenue: number;
  sale_profit: number;
  repair_cost: number;
  total_revenue: number;
  total_profit: number;
}

export interface YearlyReport {
  year: number;
  months: YearlyReportMonth[];
  totals: Omit<YearlyReportMonth, 'month' | 'active_contracts'>;
}

export interface CustomerSummary {
  customer_name: string;
  customer_dataverse_id: string;
  active_contracts: number;
  monthly_revenue: number;
  monthly_profit: number;
  earliest_end_date: string;
  latest_end_date: string;
}

export interface AuditLog {
  id: number;
  table_name: string;
  record_id: number;
  action: string;
  user_name: string;
  user_email: string;
  details: string;
  created_at: string;
}

export interface ContractRepair {
  id: number;
  repair_date: string;
  repair_cost: number;
  description: string;
}

export interface RentalContractDetail extends RentalContract {
  repairs: ContractRepair[];
}
