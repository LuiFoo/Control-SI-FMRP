import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    // Obter token do header Authorization ou cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { mes, ano, data_inicio, data_fim, status, itens } = body;

    if (!mes || !ano || !itens || !Array.isArray(itens)) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: mes, ano, itens' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('fmrp');

    // Garantir que itens seja um array válido
    const itensArray = Array.isArray(itens) ? itens : [];
    
    const revisao = {
      mes: Number(mes),
      ano: Number(ano),
      data_inicio: new Date(data_inicio),
      data_fim: new Date(data_fim),
      usuario: payload.username,
      status: status || 'finalizada',
      itens: itensArray,
      criado_em: new Date(),
    };

    console.log('Salvando revisão:', JSON.stringify(revisao, null, 2));

    const result = await db.collection('revisoes').insertOne(revisao);

    return NextResponse.json({
      success: true,
      revisaoId: result.insertedId.toString(),
    });
  } catch (error) {
    console.error('Erro ao salvar revisão:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar revisão' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Obter token do header Authorization ou cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7)
      : request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('fmrp');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Buscar revisão específica
      const revisao = await db.collection('revisoes').findOne({
        _id: new ObjectId(id),
      });

      if (!revisao) {
        return NextResponse.json({ error: 'Revisão não encontrada' }, { status: 404 });
      }

      // Converter ObjectId para string e garantir que itens seja um array
      let itensFormatados = [];
      if (Array.isArray(revisao.itens)) {
        itensFormatados = revisao.itens;
      } else if (revisao.itens) {
        itensFormatados = [revisao.itens];
      }

      const revisaoFormatada = {
        _id: revisao._id.toString(),
        mes: revisao.mes,
        ano: revisao.ano,
        data_inicio: revisao.data_inicio,
        data_fim: revisao.data_fim,
        usuario: revisao.usuario,
        status: revisao.status,
        itens: itensFormatados,
        criado_em: revisao.criado_em,
      };

      console.log('Revisão original do MongoDB:', JSON.stringify(revisao, null, 2));
      console.log('Revisão formatada para retorno:', JSON.stringify(revisaoFormatada, null, 2));
      console.log('Itens formatados:', itensFormatados);

      return NextResponse.json({ revisao: revisaoFormatada });
    } else {
      // Buscar todas as revisões
      const revisoes = await db
        .collection('revisoes')
        .find({})
        .sort({ ano: -1, mes: -1 })
        .toArray();

      return NextResponse.json({ revisoes });
    }
  } catch (error) {
    console.error('Erro ao buscar revisões:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar revisões' },
      { status: 500 }
    );
  }
}

