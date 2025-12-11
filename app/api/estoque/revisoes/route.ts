import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { isValidObjectId } from '@/lib/utils';
import { validateMonth, validateYear, validateDate } from '@/lib/validations';

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

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Formato JSON inválido' },
        { status: 400 }
      );
    }

    const { mes, ano, data_inicio, data_fim, status, itens } = body;

    // Validar campos obrigatórios
    if (!itens || !Array.isArray(itens)) {
      return NextResponse.json(
        { error: 'Campo itens é obrigatório e deve ser um array' },
        { status: 400 }
      );
    }

    // Validar mês
    const mesValidation = validateMonth(mes);
    if (!mesValidation.valid) {
      return NextResponse.json(
        { error: mesValidation.error },
        { status: 400 }
      );
    }

    // Validar ano
    const anoValidation = validateYear(ano);
    if (!anoValidation.valid) {
      return NextResponse.json(
        { error: anoValidation.error },
        { status: 400 }
      );
    }

    // Validar datas
    const dataInicioValidation = validateDate(data_inicio, 'Data de início');
    if (!dataInicioValidation.valid) {
      return NextResponse.json(
        { error: dataInicioValidation.error },
        { status: 400 }
      );
    }

    const dataFimValidation = validateDate(data_fim, 'Data de fim');
    if (!dataFimValidation.valid) {
      return NextResponse.json(
        { error: dataFimValidation.error },
        { status: 400 }
      );
    }

    // Validar que data fim é depois de data início
    if (dataFimValidation.value! < dataInicioValidation.value!) {
      return NextResponse.json(
        { error: 'Data de fim deve ser posterior à data de início' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('fmrp');

    // Garantir que itens seja um array válido
    const itensArray = Array.isArray(itens) ? itens : [];
    
    const revisao = {
      mes: mesValidation.value!,
      ano: anoValidation.value!,
      data_inicio: dataInicioValidation.value!,
      data_fim: dataFimValidation.value!,
      usuario: payload.username,
      status: status || 'finalizada',
      itens: itensArray,
      criado_em: new Date(),
    };

    // Removido console.log para produção

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
      // Validar ObjectId
      if (!isValidObjectId(id)) {
        return NextResponse.json(
          { error: 'ID de revisão inválido' },
          { status: 400 }
        );
      }

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
        data_inicio: revisao.data_inicio instanceof Date ? revisao.data_inicio.toISOString() : revisao.data_inicio,
        data_fim: revisao.data_fim instanceof Date ? revisao.data_fim.toISOString() : revisao.data_fim,
        usuario: revisao.usuario,
        status: revisao.status,
        itens: itensFormatados,
        criado_em: revisao.criado_em instanceof Date ? revisao.criado_em.toISOString() : revisao.criado_em,
      };

      // Removidos console.logs para produção

      return NextResponse.json({ revisao: revisaoFormatada });
    } else {
      // Buscar todas as revisões
      const revisoes = await db
        .collection('revisoes')
        .find({})
        .sort({ ano: -1, mes: -1 })
        .toArray();

      // Converter ObjectId para string e garantir formato correto
      const revisoesFormatadas = revisoes.map(rev => ({
        _id: rev._id.toString(),
        mes: rev.mes,
        ano: rev.ano,
        data_inicio: rev.data_inicio instanceof Date ? rev.data_inicio.toISOString() : rev.data_inicio,
        data_fim: rev.data_fim instanceof Date ? rev.data_fim.toISOString() : rev.data_fim,
        usuario: rev.usuario,
        status: rev.status,
        itens: Array.isArray(rev.itens) ? rev.itens : [],
        criado_em: rev.criado_em instanceof Date ? rev.criado_em.toISOString() : rev.criado_em,
      }));

      return NextResponse.json({ revisoes: revisoesFormatadas });
    }
  } catch (error) {
    console.error('Erro ao buscar revisões:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar revisões' },
      { status: 500 }
    );
  }
}

