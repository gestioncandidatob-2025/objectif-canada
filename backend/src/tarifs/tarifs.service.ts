import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tarif, TarifDocument } from './schemas/tarif.schema';
import { CreateTarifDto } from './dto/create-tarif.dto';
import { UpdateTarifDto } from './dto/update-tarif.dto';

@Injectable()
export class TarifsService {
  constructor(
    @InjectModel(Tarif.name) private tarifModel: Model<TarifDocument>,
  ) {}

  create(createTarifDto: CreateTarifDto) {
    const tarif = new this.tarifModel(createTarifDto);
    return tarif.save();
  }

  findAll() {
    return this.tarifModel.find().sort({ createdAt: 1 }).exec();
  }

  findOne(id: string) {
    return this.tarifModel.findById(id).exec();
  }

  /**
   * Retourne l'offre active d'un service (une seule offre par service :
   * elle contient son propre tableau de régimes le cas échéant).
   * Utilisé par le module Inscriptions.
   */
  findActifParService(service: string) {
    return this.tarifModel.findOne({ service, actif: true }).exec();
  }

  async update(id: string, updateTarifDto: UpdateTarifDto) {
    // Quand un champ devient inutile (ex: montantNegociable passe à true),
    // sa valeur est envoyée comme "undefined" par le frontend, ce qui la
    // fait disparaître du JSON. Pour éviter qu'une ancienne valeur ne reste
    // coincée en base, on efface explicitement (via $unset) tout champ
    // rendu inutile par les nouveaux flags reçus dans CETTE requête.
    const setOps: Record<string, unknown> = { ...updateTarifDto };
    const champsAEffacer: string[] = [];

    if (updateTarifDto.montantNegociable === true) {
      champsAEffacer.push('prix');
    }
    if (updateTarifDto.dateFinNecessaire === true) {
      champsAEffacer.push('dureeJours');
    }
    if (updateTarifDto.regimeActif === false) {
      champsAEffacer.push('regimes');
    }

    const unset: Record<string, ''> = {};
    for (const champ of champsAEffacer) {
      // Un champ ne peut pas être $set ET $unset dans la même requête
      // MongoDB : on le retire donc du $set s'il y était encore présent.
      delete setOps[champ];
      unset[champ] = '';
    }

    const operation: Record<string, unknown> = { $set: setOps };
    if (Object.keys(unset).length > 0) {
      operation.$unset = unset;
    }

    const tarif = await this.tarifModel
      .findByIdAndUpdate(id, operation, { new: true })
      .exec();

    if (!tarif) {
      throw new NotFoundException('Offre introuvable');
    }
    return tarif;
  }

  async remove(id: string) {
    const tarif = await this.tarifModel.findByIdAndDelete(id).exec();
    if (!tarif) {
      throw new NotFoundException('Offre introuvable');
    }
    return tarif;
  }
}