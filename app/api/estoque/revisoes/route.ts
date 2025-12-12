import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { isValidObjectId } from '@/lib/utils';
import { validateMonth, validateYear, validateDate } from '@/lib/validations';
import { verifyLoginPermission } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    // Verificar permissão de login (desloga se não tiver)
    const loginCheck = await verifyLoginPermission(request);
    if (!loginCheck.valid) {
      return loginCheck.response!;
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

    // Validar que o array não está vazio
    if (itens.length === 0) {
      return NextResponse.json(
        { error: 'O array de itens não pode estar vazio' },
        { status: 400 }
      );
    }

    // Validar estrutura básica dos itens
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      if (!item || typeof item !== 'object') {
        return NextResponse.json(
          { error: `Item no índice ${i} é inválido` },
          { status: 400 }
        );
      }
      if (!item.item_id || typeof item.item_id !== 'string') {
        return NextResponse.json(
          { error: `Item no índice ${i} deve ter um item_id válido` },
          { status: 400 }
        );
      }
      if (!item.nome_item || typeof item.nome_item !== 'string') {
        return NextResponse.json(
          { error: `Item no índice ${i} deve ter um nome_item válido` },
          { status: 400 }
        );
      }
      // Validar sistema - aceitar number ou string que pode ser convertida para number
      const sistemaNum = typeof item.sistema === 'number' ? item.sistema : Number(item.sistema);
      if (isNaN(sistemaNum) || sistemaNum < 0) {
        return NextResponse.json(
          { error: `Item no índice ${i} deve ter um sistema válido (número >= 0)` },
          { status: 400 }
        );
      }
      
      // Validar contado - aceitar number, string que pode ser convertida, ou null
      if (item.contado !== null && item.contado !== undefined) {
        const contadoNum = typeof item.contado === 'number' ? item.contado : Number(item.contado);
        if (isNaN(contadoNum) || contadoNum < 0) {
          return NextResponse.json(
            { error: `Item no índice ${i} deve ter um contado válido (número >= 0 ou null)` },
            { status: 400 }
          );
        }
      }
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

    // Garantir que itens seja um array válido e normalizar os dados
    const itensArray = Array.isArray(itens) ? itens : [];
    
    // Interface para item de revisão recebido
    interface ItemRevisaoInput {
      item_id?: string;
      nome_item?: string;
      sistema?: number | string | null;
      contado?: number | string | null;
      status?: 'certo' | 'errado' | null;
    }
    
    // Normalizar itens: garantir que contado e sistema sejam números válidos
    const itensNormalizados = itensArray.map((item: ItemRevisaoInput) => {
      // Garantir que contado seja um número ou null
      let contado = null;
      if (item.contado !== null && item.contado !== undefined) {
        const contadoNum = Number(item.contado);
        contado = isNaN(contadoNum) ? null : contadoNum;
      }
      
      // Garantir que sistema seja um número
      let sistema = 0;
      if (item.sistema !== null && item.sistema !== undefined) {
        const sistemaNum = Number(item.sistema);
        sistema = isNaN(sistemaNum) ? 0 : sistemaNum;
      }
      
      return {
        item_id: item.item_id || '',
        nome_item: item.nome_item || '',
        sistema: sistema,
        contado: contado,
        status: item.status || null,
      };
    });
    
    const revisao = {
      mes: mesValidation.value!,
      ano: anoValidation.value!,
      data_inicio: dataInicioValidation.value!,
      data_fim: dataFimValidation.value!,
      usuario: loginCheck.username!,
      status: status || 'finalizada',
      itens: itensNormalizados,
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
    // Verificar permissão de login (desloga se não tiver)
    const loginCheck = await verifyLoginPermission(request);
    if (!loginCheck.valid) {
      return loginCheck.response!;
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

