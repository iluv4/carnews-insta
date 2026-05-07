'use client';
import CardGenerator from "@/components/CardGenerator";
import AmazonGenerator from "@/components/AmazonGenerator";
import { useTab } from "@/context/TabContext";

export default function DashboardPage() {
  const { activeTab } = useTab();
  if (activeTab === 'amazon') return <AmazonGenerator />;
  return <CardGenerator />;
}
