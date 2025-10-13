"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const barData = [
  { name: "Ene", proyectos: 4, solicitudes: 12 },
  { name: "Feb", proyectos: 3, solicitudes: 15 },
  { name: "Mar", proyectos: 6, solicitudes: 20 },
  { name: "Abr", proyectos: 8, solicitudes: 18 },
  { name: "May", proyectos: 5, solicitudes: 22 },
  { name: "Jun", proyectos: 7, solicitudes: 25 },
];

const lineData = [
  { name: "Sem 1", presupuesto: 50000, ejecutado: 35000 },
  { name: "Sem 2", presupuesto: 52000, ejecutado: 42000 },
  { name: "Sem 3", presupuesto: 48000, ejecutado: 38000 },
  { name: "Sem 4", presupuesto: 55000, ejecutado: 48000 },
];

const pieData = [
  { name: "En progreso", value: 35, color: "#3b82f6" },
  { name: "Completados", value: 45, color: "#22c55e" },
  { name: "Pendientes", value: 20, color: "#f59e0b" },
];

export default function DashboardProyectosList() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Dashboard de Proyectos</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Proyectos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">33</div>
            <p className="text-xs text-muted-foreground">+12% desde el mes pasado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitudes Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">112</div>
            <p className="text-xs text-muted-foreground">+23% desde el mes pasado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$205,000</div>
            <p className="text-xs text-muted-foreground">Activos en curso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Completitud</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">73%</div>
            <p className="text-xs text-muted-foreground">+8% desde el mes pasado</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proyectos y Solicitudes por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="proyectos" fill="#3b82f6" />
                <Bar dataKey="solicitudes" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Proyectos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Presupuesto vs Ejecutado (Últimas 4 Semanas)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="presupuesto"
                stroke="#3b82f6"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="ejecutado"
                stroke="#22c55e"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
