// Script de diagnóstico para verificar la conexión con el backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function testBackend() {
  console.log('🔍 Verificando conexión con el backend...');
  console.log(`API URL: ${API_URL}`);
  
  try {
    // Test 1: Verificar que el backend responda
    console.log('\n📡 Test 1: Ping al servidor...');
    const healthResponse = await fetch(`${API_URL}/`);
    console.log(`Status: ${healthResponse.status}`);
    
    if (healthResponse.ok) {
      console.log('✅ Backend responde correctamente');
    } else {
      console.log('❌ Backend respondió con error');
    }

    // Test 2: Verificar endpoint de nóminas
    console.log('\n📡 Test 2: Verificando endpoint /nominas...');
    const nominasResponse = await fetch(`${API_URL}/nominas`);
    console.log(`Status: ${nominasResponse.status}`);
    
    if (nominasResponse.ok) {
      const data = await nominasResponse.json();
      console.log(`✅ Endpoint /nominas funciona. Total registros: ${data.total || 0}`);
    } else {
      const errorText = await nominasResponse.text();
      console.log(`❌ Error en /nominas: ${errorText}`);
    }

    // Test 3: Verificar endpoint de users
    console.log('\n📡 Test 3: Verificando endpoint /users...');
    const usersResponse = await fetch(`${API_URL}/users`);
    console.log(`Status: ${usersResponse.status}`);
    
    if (usersResponse.ok) {
      const data = await usersResponse.json();
      console.log(`✅ Endpoint /users funciona. Total registros: ${data.total || 0}`);
    } else {
      const errorText = await usersResponse.text();
      console.log(`❌ Error en /users: ${errorText}`);
    }

  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.log('\n⚠️  Verifica que:');
    console.log('   1. El backend esté corriendo (uvicorn)');
    console.log('   2. El puerto 8000 esté disponible');
    console.log('   3. No haya problemas de CORS');
  }
}

testBackend();
